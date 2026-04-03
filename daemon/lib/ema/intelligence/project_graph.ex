defmodule Ema.Intelligence.ProjectGraph do
  @moduledoc """
  Builds a live project knowledge graph from multiple data sources.

  Data sources:
  - EMA projects, tasks, proposals (from DB)
  - Executions and their states
  - Intent nodes from IntentMap
  - Vault connections (via SecondBrain)

  Returns a graph with:
  - nodes: [%{id, name, type, status, health_score, metrics, inserted_at}]
  - edges: [%{from, to, type, label}]

  Node types: "project", "proposal", "execution", "intent", "vault_note"
  Edge types: "has_proposal", "has_execution", "implements", "references", "evolves_from"
  """

  require Logger

  alias Ema.Projects
  alias Ema.Proposals
  alias Ema.Executions
  alias Ema.Intelligence.IntentMap
  alias Ema.Tasks

  # ── Public API ────────────────────────────────────────────────────────────

  @doc "Build the full project knowledge graph."
  def build do
    nodes =
      []
      |> collect_project_nodes()
      |> collect_proposal_nodes()
      |> collect_execution_nodes()
      |> collect_intent_nodes()

    edges = build_edges(nodes)

    %{nodes: nodes, edges: edges}
  end

  @doc "Build a focused graph centered on a single project."
  def build_for_project(project_id) do
    project = Projects.get_project(project_id)

    if is_nil(project) do
      %{nodes: [], edges: []}
    else
      project_node = node_from_project(project)

      proposal_nodes =
        Proposals.list_proposals(project_id: project_id, limit: 20)
        |> Enum.map(&node_from_proposal/1)

      execution_nodes =
        Executions.list_executions(project_slug: project_id)
        |> Enum.map(&node_from_execution/1)

      intent_nodes =
        IntentMap.list_nodes(project_id: project_id)
        |> Enum.map(&node_from_intent_node/1)

      nodes = [project_node | proposal_nodes ++ execution_nodes ++ intent_nodes]
      edges = build_edges(nodes)

      %{nodes: nodes, edges: edges}
    end
  end

  @doc "Get detailed info for a single node by id."
  def get_node_detail(node_id) do
    cond do
      String.starts_with?(node_id, "proj-") ->
        id = String.replace_prefix(node_id, "proj-", "")

        case Projects.get_project(id) do
          nil -> nil
          project -> node_from_project(project) |> Map.put(:detail, project_detail(project))
        end

      String.starts_with?(node_id, "prop-") ->
        id = String.replace_prefix(node_id, "prop-", "")

        case Proposals.get_proposal(id) do
          nil -> nil
          proposal -> node_from_proposal(proposal) |> Map.put(:detail, %{body: proposal.body, status: proposal.status})
        end

      String.starts_with?(node_id, "exec-") ->
        id = String.replace_prefix(node_id, "exec-", "")

        case Executions.get_execution(id) do
          nil -> nil
          execution -> node_from_execution(execution)
        end

      String.starts_with?(node_id, "int-") ->
        id = String.replace_prefix(node_id, "int-", "")

        case IntentMap.get_node(id) do
          nil -> nil
          node -> node_from_intent_node(node)
        end

      true ->
        nil
    end
  end

  # ── Node Builders ─────────────────────────────────────────────────────────

  def node_from_project(project) do
    metrics = metrics_for_project(project.id)
    score = health_score_for_project(project, metrics)

    %{
      id: "proj-#{project.id}",
      name: project.name,
      type: "project",
      status: project.status || "active",
      health_score: score,
      metrics: metrics,
      color: "#4f8ef7",
      inserted_at: project.inserted_at
    }
  end

  def node_from_proposal(proposal) do
    %{
      id: "prop-#{proposal.id}",
      name: proposal.title,
      type: "proposal",
      status: proposal.status || "pending",
      health_score: proposal_health(proposal),
      metrics: %{
        project_id: proposal.project_id,
        generation: Map.get(proposal.generation_log || %{}, "iteration", 0),
        score: Map.get(proposal.score_breakdown || %{}, "total", 0)
      },
      color: "#f7b94f",
      inserted_at: proposal.inserted_at
    }
  end

  def node_from_execution(execution) do
    %{
      id: "exec-#{execution.id}",
      name: execution.title || execution.objective || "Execution",
      type: "execution",
      status: execution.status || "created",
      health_score: execution_health(execution),
      metrics: %{
        mode: execution.mode,
        intent_slug: execution.intent_slug,
        proposal_id: execution.proposal_id
      },
      color: "#4ff7a0",
      inserted_at: execution.inserted_at
    }
  end

  def node_from_intent_node(node) do
    %{
      id: "int-#{node.id}",
      name: node.title,
      type: "intent",
      status: node.status || "active",
      health_score: 0.7,
      metrics: %{
        level: node.level,
        project_id: node.project_id,
        parent_id: node.parent_id
      },
      color: "#b94ff7",
      inserted_at: node.inserted_at
    }
  end

  # ── Node Collectors ───────────────────────────────────────────────────────

  defp collect_project_nodes(acc) do
    projects = Projects.list_projects()
    project_nodes = Enum.map(projects, &node_from_project/1)
    acc ++ project_nodes
  end

  defp collect_proposal_nodes(acc) do
    proposals = Proposals.list_proposals(limit: 30)
    proposal_nodes = Enum.map(proposals, &node_from_proposal/1)
    acc ++ proposal_nodes
  end

  defp collect_execution_nodes(acc) do
    executions = Executions.list_executions()
    execution_nodes = Enum.map(executions, &node_from_execution/1)
    acc ++ execution_nodes
  end

  defp collect_intent_nodes(acc) do
    nodes = IntentMap.list_nodes()
    intent_nodes = Enum.map(nodes, &node_from_intent_node/1)
    acc ++ intent_nodes
  end

  # ── Edge Builder ──────────────────────────────────────────────────────────

  def build_edges(nodes) do
    node_map = Map.new(nodes, fn n -> {n.id, n} end)

    # Project → Proposal edges
    proposal_edges =
      for node <- nodes,
          node.type == "proposal",
          project_id = node.metrics[:project_id],
          not is_nil(project_id),
          Map.has_key?(node_map, "proj-#{project_id}") do
        %{from: "proj-#{project_id}", to: node.id, type: "has_proposal", label: "proposes"}
      end

    # Project → Execution edges
    execution_edges =
      for node <- nodes,
          node.type == "execution",
          proposal_id = node.metrics[:proposal_id],
          not is_nil(proposal_id),
          prop_node = Map.get(node_map, "prop-#{proposal_id}"),
          not is_nil(prop_node) do
        %{from: "prop-#{proposal_id}", to: node.id, type: "has_execution", label: "executes"}
      end

    # Intent parent → child edges
    intent_edges =
      for node <- nodes,
          node.type == "intent",
          parent_id = node.metrics[:parent_id],
          not is_nil(parent_id),
          Map.has_key?(node_map, "int-#{parent_id}") do
        %{from: "int-#{parent_id}", to: node.id, type: "implements", label: "implements"}
      end

    # Intent → Project edges
    intent_project_edges =
      for node <- nodes,
          node.type == "intent",
          project_id = node.metrics[:project_id],
          not is_nil(project_id),
          Map.has_key?(node_map, "proj-#{project_id}") do
        %{from: "proj-#{project_id}", to: node.id, type: "references", label: "intent"}
      end

    proposal_edges ++ execution_edges ++ intent_edges ++ intent_project_edges
  end

  # ── Health Scoring ────────────────────────────────────────────────────────

  @doc "Calculate project health score (0.0-1.0). Higher is healthier."
  def health_score_for_project(project, metrics) do
    base =
      case project.status do
        "active" -> 0.8
        "incubating" -> 0.6
        "paused" -> 0.3
        "archived" -> 0.1
        _ -> 0.5
      end

    # Penalize for open todos
    todo_penalty = min(metrics.open_todos * 0.02, 0.3)

    # Reward for recent activity
    activity_bonus =
      if metrics.execution_count > 0 do
        min(metrics.execution_count * 0.05, 0.2)
      else
        0.0
      end

    Float.round(max(base - todo_penalty + activity_bonus, 0.0), 2)
  end

  def metrics_for_project(project_id) do
    tasks = Tasks.list_tasks(project_id: project_id)
    open_todos = Enum.count(tasks, fn t -> t.status in ["todo", "backlog"] end)

    proposals = Proposals.list_proposals(project_id: project_id)
    proposal_count = length(proposals)

    executions = Executions.list_executions(project_slug: project_id)
    execution_count = length(executions)

    %{
      open_todos: open_todos,
      proposal_count: proposal_count,
      execution_count: execution_count
    }
  rescue
    _ ->
      %{open_todos: 0, proposal_count: 0, execution_count: 0}
  end

  defp proposal_health(proposal) do
    case proposal.status do
      "approved" -> 0.9
      "queued" -> 0.7
      "pending" -> 0.6
      "killed" -> 0.1
      "redirected" -> 0.5
      _ -> 0.5
    end
  end

  defp execution_health(execution) do
    case execution.status do
      "completed" -> 1.0
      "running" -> 0.8
      "delegated" -> 0.75
      "approved" -> 0.7
      "created" -> 0.6
      "cancelled" -> 0.1
      "failed" -> 0.1
      _ -> 0.5
    end
  end

  defp project_detail(project) do
    %{
      slug: project.slug,
      description: project.description,
      status: project.status,
      context: project.context,
      github_url: project.github_url
    }
  end
end
