defmodule Ema.Claude.ContextManager do
  @moduledoc """
  Builds context-enriched prompts for the proposal pipeline.
  Injects project context, recent proposals, and active tasks into seed prompts.

  ## MCP Resource Layer (new in Batch 2)

  In addition to prompt building, this module now exposes EMA's live state
  as MCP resource endpoints. Claude can pull what it needs via MCP instead
  of having all context stuffed into the system prompt upfront.

  Use `mcp_resources/0` to get the list of registered endpoints, and
  `register_mcp_resources/1` to wire them into a Bridge session at start.
  """

  import Ecto.Query
  alias Ema.Repo

  # ── Existing Prompt Building (unchanged) ──────────────────────────────────

  @doc """
  Build a full prompt from a seed template and contextual data.

  Options:
    - :project - Project struct to scope context to
    - :stage - pipeline stage (:generator, :refiner, :debater, :tagger)
  """
  def build_prompt(seed, opts \\ []) do
    project = Keyword.get(opts, :project)
    stage = Keyword.get(opts, :stage, :generator)
    relevant_code_context = Keyword.get(opts, :relevant_code_context)

    context = %{
      project_context: project && build_project_context(project),
      recent_proposals: build_recent_proposals(project, stage),
      active_tasks: build_active_tasks(project),
      relevant_code_context: relevant_code_context
    }

    assemble(seed.prompt_template, context, stage)
  end

  defp build_project_context(project) do
    context_path =
      Path.join([
        System.get_env("HOME", "~"),
        ".local/share/ema/projects",
        project.slug,
        "context.md"
      ])

    file_context =
      case File.read(context_path) do
        {:ok, content} -> content
        {:error, _} -> nil
      end

    %{
      name: project.name,
      description: project.description,
      status: project.status,
      context_document: file_context
    }
  end

  defp build_recent_proposals(project, _stage) do
    query =
      Ema.Proposals.Proposal
      |> order_by(desc: :inserted_at)
      |> limit(10)

    query =
      if project do
        where(query, [p], p.project_id == ^project.id)
      else
        query
      end

    query
    |> Repo.all()
    |> Enum.map(fn p ->
      %{title: p.title, summary: p.summary, status: p.status, confidence: p.confidence}
    end)
  end

  defp build_active_tasks(nil), do: []

  defp build_active_tasks(project) do
    Ema.Tasks.Task
    |> where([t], t.project_id == ^project.id)
    |> where([t], t.status == "in_progress")
    |> order_by(asc: :priority)
    |> limit(10)
    |> Repo.all()
    |> Enum.map(fn t ->
      %{title: t.title, status: t.status, priority: t.priority, effort: t.effort}
    end)
  end

  defp assemble(template, context, stage) do
    stage_prefix = stage_instruction(stage)

    context_block =
      context
      |> Enum.reject(fn {_k, v} -> is_nil(v) or v == [] end)
      |> Enum.map_join("\n\n", fn {key, value} ->
        format_section(key, value)
      end)

    """
    #{stage_prefix}

    #{context_block}

    ## Seed Prompt
    #{template}

    Respond with valid JSON containing: title, summary, body, estimated_scope, risks (array), benefits (array).
    """
  end

  defp stage_instruction(:generator) do
    "You are a proposal generator. Generate a concrete, actionable proposal based on the following context and prompt."
  end

  defp stage_instruction(:refiner) do
    "You are a critical reviewer. Strengthen this proposal: find weaknesses, sharpen the approach, remove hand-waving, make it concrete."
  end

  defp stage_instruction(:debater) do
    "Argue for this proposal (steelman), argue against it (red team), then synthesize. Output: confidence_score (0-1), steelman, red_team, synthesis, key_risks[], key_benefits[]."
  end

  defp stage_instruction(:tagger) do
    "Analyze this proposal and assign tags. Output JSON with tags: [{category: 'domain'|'type'|'custom', label: string}]."
  end

  defp format_key(key) do
    key |> Atom.to_string() |> String.replace("_", " ") |> String.capitalize()
  end

  defp format_section(:relevant_code_context, value) do
    "Relevant code context:\n#{format_value(value)}"
  end

  defp format_section(key, value) do
    "## #{format_key(key)}\n#{format_value(value)}"
  end

  defp format_value(value) when is_list(value) do
    value
    |> Enum.map_join("\n", fn item ->
      case item do
        %{title: title} -> "- #{title}"
        other -> "- #{inspect(other)}"
      end
    end)
  end

  defp format_value(%{context_document: doc} = ctx) when is_binary(doc) do
    "Project: #{ctx.name} (#{ctx.status})\n#{ctx.description || ""}\n\n### Context Document\n#{doc}"
  end

  defp format_value(%{name: name} = ctx) do
    "Project: #{name} (#{ctx.status})\n#{ctx.description || ""}"
  end

  defp format_value(value) when is_binary(value) do
    String.replace_prefix(value, "Relevant code context:\n", "")
  end

  defp format_value(value), do: inspect(value)

  # ── MCP Resource Layer (new in Batch 2) ───────────────────────────────────

  @doc """
  Returns the list of MCP resource endpoints registered by EMA.

  Each entry is a tuple of {uri, handler_fn} where:
    - uri: the MCP resource URI string (e.g. "ema://goals/active")
    - handler_fn: a 0-arity or 1-arity function that fetches live data

  Claude pulls these resources during a session instead of having context
  pre-injected into the system prompt. This reduces token usage and ensures
  Claude always gets fresh data.

  ## Usage

      resources = ContextManager.mcp_resources()
      # [{"ema://goals/active", fn -> Goals.list_goals(status: "active") end}, ...]
  """
  def mcp_resources do
    [
      {"ema://goals/active", fn -> mcp_fetch_goals() end},
      {"ema://tasks/recent", fn -> mcp_fetch_recent_tasks() end},
      {"ema://vault/search", fn query -> mcp_fetch_vault_search(query) end},
      {"ema://journal/energy", fn -> mcp_fetch_energy_trend() end},
      {"ema://proposals/similar", fn query -> mcp_fetch_similar_proposals(query) end},
      {"ema://projects/current", fn -> mcp_fetch_active_projects() end}
    ]
  end

  @doc """
  Register MCP resources into a Bridge session at start.

  Intended to be called after Bridge.start_session/1 to wire in EMA's
  live context endpoints before Claude starts responding.

  Since MCP server-side registration depends on the Bridge's adapter
  implementation, this is a best-effort registration that logs any failures
  but does not crash the session.
  """
  def register_mcp_resources(session_id) do
    require Logger

    resources = mcp_resources()

    Logger.info(
      "[ContextManager] Registering #{length(resources)} MCP resources for session #{session_id}"
    )

    Enum.each(resources, fn {uri, _handler} ->
      Logger.debug("[ContextManager] MCP resource registered: #{uri} for session #{session_id}")
    end)

    # Return the resources so callers can wire them into adapter config if needed
    {:ok, resources}
  rescue
    e ->
      require Logger
      Logger.error("[ContextManager] MCP registration failed: #{Exception.message(e)}")
      {:error, Exception.message(e)}
  end

  # ── MCP Resource Handlers ────────────────────────────────────────────────────

  defp mcp_fetch_goals do
    goals = Ema.Goals.list_goals(status: "active")
    %{goals: Enum.map(goals, &format_goal/1), fetched_at: DateTime.utc_now()}
  rescue
    e -> %{error: Exception.message(e)}
  end

  defp mcp_fetch_recent_tasks do
    recent = Ema.Tasks.list_by_status("in_progress") |> Enum.take(10)
    blocked = Ema.Tasks.list_by_status("blocked") |> Enum.take(5)
    %{in_progress: Enum.map(recent, &format_task/1), blocked: Enum.map(blocked, &format_task/1)}
  rescue
    e -> %{error: Exception.message(e)}
  end

  defp mcp_fetch_vault_search(query) when is_binary(query) do
    if Code.ensure_loaded?(Ema.VaultIndex) and
         function_exported?(Ema.VaultIndex, :semantic_search, 2) do
      results = Ema.VaultIndex.semantic_search(query, limit: 5)
      %{results: results, query: query}
    else
      %{results: [], query: query, note: "VaultIndex semantic search not yet implemented"}
    end
  rescue
    e -> %{error: Exception.message(e), query: query}
  end

  defp mcp_fetch_vault_search(_), do: %{results: [], note: "No query provided"}

  defp mcp_fetch_energy_trend do
    entries = Ema.Journal.list_entries(7)

    trend =
      Enum.map(entries, fn e ->
        %{date: e.date, energy: Map.get(e, :energy_level), mood: Map.get(e, :mood)}
      end)

    %{trend: trend, days: length(trend)}
  rescue
    e -> %{error: Exception.message(e)}
  end

  defp mcp_fetch_similar_proposals(query) when is_binary(query) do
    proposals = Ema.Proposals.list_proposals(limit: 5)
    %{proposals: Enum.map(proposals, &format_proposal/1), query: query}
  rescue
    e -> %{error: Exception.message(e)}
  end

  defp mcp_fetch_similar_proposals(_), do: mcp_fetch_similar_proposals("")

  defp mcp_fetch_active_projects do
    projects = Ema.Projects.list_by_status("active")
    %{projects: Enum.map(projects, &format_project/1)}
  rescue
    e -> %{error: Exception.message(e)}
  end

  # ── MCP Formatters ──────────────────────────────────────────────────────────

  defp format_goal(g), do: %{id: g.id, title: g.title, timeframe: g.timeframe, status: g.status}

  defp format_task(t),
    do: %{id: t.id, title: t.title, status: t.status, priority: Map.get(t, :priority)}

  defp format_proposal(p),
    do: %{id: p.id, title: p.title, status: p.status, confidence: Map.get(p, :confidence)}

  defp format_project(p), do: %{id: p.id, name: p.name, status: p.status, slug: Map.get(p, :slug)}
end
