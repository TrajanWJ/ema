defmodule Ema.Intelligence.SupermanClient do
  @moduledoc """
  Local code intelligence — replaces external HTTP service with
  EMA's own KnowledgeGraph, vault search, and intent tree.
  """

  alias Ema.Superman.KnowledgeGraph

  def health_check do
    {:ok, %{"status" => "local", "mode" => "embedded"}}
  end

  def get_status do
    nodes = try do KnowledgeGraph.context_for("ema") rescue _ -> [] end
    {:ok, %{"nodes" => length(nodes), "mode" => "local"}}
  end

  def index_repo(repo_path) do
    files = Path.wildcard(Path.join(repo_path, "**/*.{ex,ts}"))

    nodes =
      Enum.map(files, fn path ->
        name = Path.basename(path, Path.extname(path))
        %{type: "module", title: name, content: path, tags: [Path.extname(path)]}
      end)

    KnowledgeGraph.ingest(nodes, "ema")
    {:ok, %{"indexed" => length(files), "repo" => repo_path}}
  rescue
    e -> {:error, Exception.message(e)}
  end

  def ask_codebase(query, _repo_path) do
    vault_results = try do Ema.SecondBrain.search_brain(query) rescue _ -> [] end
    graph_nodes = try do KnowledgeGraph.context_for("ema") rescue _ -> [] end

    {:ok, %{
      "answer" => "Local search results for: #{query}",
      "vault_matches" => length(vault_results),
      "graph_nodes" => length(graph_nodes),
      "sources" => Enum.take(vault_results, 5)
    }}
  end

  def get_gaps do
    gaps = try do Ema.Intelligence.GapInbox.list_gaps() rescue _ -> [] end
    {:ok, %{"gaps" => gaps, "count" => length(gaps)}}
  end

  def get_flows do
    md = try do Ema.Intents.export_markdown() rescue _ -> "_No intents._" end
    {:ok, %{"flows" => md}}
  end

  def get_intent_graph do
    intents = try do Ema.Intents.list_intents() rescue _ -> [] end

    nodes = Enum.map(intents, fn i ->
      %{"id" => i.id, "title" => i.title, "level" => i.level, "status" => i.status}
    end)

    edges = intents
    |> Enum.filter(& &1.parent_id)
    |> Enum.map(fn i -> %{"from" => i.parent_id, "to" => i.id, "type" => "parent"} end)

    {:ok, %{"nodes" => nodes, "edges" => edges}}
  end

  def apply_task(instruction) do
    case Ema.Tasks.create_task(%{title: instruction, status: "todo"}) do
      {:ok, task} -> {:ok, %{"task_id" => task.id, "title" => task.title}}
      {:error, reason} -> {:error, reason}
    end
  end

  def get_panels do
    context = try do Ema.Superman.context_bundle_for("ema") rescue _ -> %{} end
    {:ok, %{"panels" => context}}
  end

  def build_task(task) do
    apply_task(task)
  end

  def simulate_flow(_entry_point), do: {:error, :not_implemented}
  def autonomous_run, do: {:error, :not_implemented}
end
