defmodule Ema.Claude.ContextInjector do
  @moduledoc """
  Context Enrichment: builds a structured context map for Claude sessions.

  Given an event and a list of context keys, fetches live data from each
  domain module and assembles it into a structured map for use by the
  Intelligence Router and Pipes claude_action.

  Keys: [:project, :goals, :vault, :tasks, :energy, :proposals, :intents, :wiki]

  Returns:
    {:ok, context_map}   — always, even if some keys fail (graceful degradation)
    {:error, reason}     — only on catastrophic/unexpected failures

  Failed key fetches are logged and excluded from the result (not hard errors).
  """

  require Logger

  alias Ema.{Goals, Tasks, Proposals, Projects, Journal, Intents}

  # ── Public API ──────────────────────────────────────────────────────────────

  @doc """
  Build enriched context for an event using the given keys.

  ## Keys
    - :project   — full project context scoped by event's project_id
    - :goals     — active goal tree
    - :vault     — semantic search results from VaultIndex (top-5)
    - :tasks     — recent + blocked tasks
    - :energy    — recent energy trend from journal entries
    - :proposals — similar proposals by semantic/contextual match

  Returns {:ok, map} with only the keys that succeeded.
  """
  def build_context(event, keys) when is_list(keys) do
    Logger.debug("[ContextInjector] Building context for #{inspect(keys)}")

    context =
      keys
      |> Enum.map(fn key -> {key, fetch_context_key(key, event)} end)
      |> Enum.reduce(%{}, fn {key, result}, acc ->
        case result do
          {:ok, value} ->
            Map.put(acc, key, value)

          {:error, reason} ->
            Logger.warning("[ContextInjector] Failed to fetch #{key}: #{inspect(reason)}")
            acc
        end
      end)

    {:ok, context}
  rescue
    e ->
      Logger.error("[ContextInjector] Unexpected error: #{Exception.message(e)}")
      {:error, {:injector_crash, Exception.message(e)}}
  end

  # ── Private: Per-Key Fetchers ────────────────────────────────────────────────

  defp fetch_context_key(:project, event) do
    project_id = extract_project_id(event)

    if project_id do
      with project when not is_nil(project) <- Projects.get_project(project_id),
           context <- build_project_context(project) do
        {:ok, context}
      else
        nil -> {:error, {:not_found, "project #{project_id}"}}
        err -> {:error, err}
      end
    else
      {:error, {:missing, :project_id}}
    end
  rescue
    e -> {:error, {:fetch_failed, :project, Exception.message(e)}}
  end

  defp fetch_context_key(:goals, _event) do
    goals = Goals.list_goals(status: "active")
    tree = build_goal_tree(goals)
    {:ok, tree}
  rescue
    e -> {:error, {:fetch_failed, :goals, Exception.message(e)}}
  end

  defp fetch_context_key(:vault, event) do
    # VaultIndex.semantic_search is deprecated/stub — use graceful fallback
    query = extract_vault_query(event)

    result =
      if Code.ensure_loaded?(Ema.VaultIndex) and
           function_exported?(Ema.VaultIndex, :semantic_search, 2) do
        Ema.VaultIndex.semantic_search(query, limit: 5)
      else
        # VaultIndex not yet implemented — return empty results
        []
      end

    {:ok, %{query: query, results: result, count: length(List.wrap(result))}}
  rescue
    e -> {:error, {:fetch_failed, :vault, Exception.message(e)}}
  end

  defp fetch_context_key(:tasks, event) do
    project_id = extract_project_id(event)

    recent =
      if project_id do
        Tasks.list_by_project(project_id)
        |> Enum.take(10)
      else
        Tasks.list_by_status("in_progress")
        |> Enum.take(10)
      end

    blocked =
      Tasks.list_by_status("blocked")
      |> Enum.take(5)

    {:ok, %{recent: format_tasks(recent), blocked: format_tasks(blocked)}}
  rescue
    e -> {:error, {:fetch_failed, :tasks, Exception.message(e)}}
  end

  defp fetch_context_key(:energy, _event) do
    recent_entries = Journal.list_entries(7)

    trend =
      recent_entries
      |> Enum.map(fn entry ->
        %{
          date: entry.date,
          energy: Map.get(entry, :energy_level),
          mood: Map.get(entry, :mood),
          one_thing: Map.get(entry, :one_thing)
        }
      end)
      |> Enum.reject(fn e -> is_nil(e.energy) and is_nil(e.mood) end)

    avg_energy =
      trend
      |> Enum.map(& &1.energy)
      |> Enum.reject(&is_nil/1)
      |> average()

    {:ok, %{trend: trend, average_energy: avg_energy, sample_days: length(trend)}}
  rescue
    e -> {:error, {:fetch_failed, :energy, Exception.message(e)}}
  end

  defp fetch_context_key(:proposals, event) do
    project_id = extract_project_id(event)
    event_title = extract_event_title(event)

    similar =
      if project_id do
        Proposals.list_proposals(project_id: project_id, limit: 5)
      else
        Proposals.list_proposals(limit: 5)
      end

    {:ok, %{similar: format_proposals(similar), query: event_title}}
  rescue
    e -> {:error, {:fetch_failed, :proposals, Exception.message(e)}}
  end

  defp fetch_context_key(:intents, event) do
    project_id = extract_project_id(event)

    intents =
      if project_id do
        Intents.list_intents(project_id: project_id, limit: 20)
      else
        Intents.list_intents(status: "active", limit: 20)
      end

    tree_md = Intents.export_markdown(project_id: project_id)

    {:ok, %{
      tree: tree_md,
      active_count: length(Enum.filter(intents, &(&1.status == "active"))),
      implementing_count: length(Enum.filter(intents, &(&1.status == "implementing")))
    }}
  rescue
    e -> {:error, {:fetch_failed, :intents, Exception.message(e)}}
  end

  defp fetch_context_key(:wiki, event) do
    project_id = extract_project_id(event)
    vault_root = Ema.SecondBrain.vault_root()
    wiki_dir = Path.join([vault_root, "wiki", "Intents"])

    pages =
      if File.dir?(wiki_dir) do
        Path.wildcard(Path.join(wiki_dir, "**/*.md"))
        |> Enum.reject(&String.ends_with?(&1, "_index.md"))
        |> Enum.map(fn path ->
          content = File.read!(path)
          fm = Ema.SecondBrain.VaultWatcher.parse_frontmatter(content)

          if fm["intent_level"] do
            # Strip frontmatter for the content preview
            body =
              content
              |> String.replace(~r/\A---.*?---\n*/s, "")
              |> String.slice(0, 800)

            %{
              title: fm["title"],
              level: fm["intent_level"],
              kind: fm["intent_kind"],
              status: fm["intent_status"],
              project: fm["project"],
              body: body,
              path: Path.relative_to(path, vault_root)
            }
          end
        end)
        |> Enum.reject(&is_nil/1)
        |> maybe_filter_wiki_by_project(project_id)
      else
        []
      end

    {:ok, %{intent_pages: pages, count: length(pages)}}
  rescue
    e -> {:error, {:fetch_failed, :wiki, Exception.message(e)}}
  end

  defp fetch_context_key(unknown_key, _event) do
    Logger.debug("[ContextInjector] Unknown context key: #{inspect(unknown_key)}")
    {:error, {:unknown_key, unknown_key}}
  end

  defp maybe_filter_wiki_by_project(pages, nil), do: pages
  defp maybe_filter_wiki_by_project(pages, project_id) do
    project = Projects.get_project(project_id)
    slug = if project, do: project.slug

    if slug do
      Enum.filter(pages, fn p -> p.project == slug or is_nil(p.project) end)
    else
      pages
    end
  end

  # ── Private: Formatters ──────────────────────────────────────────────────────

  defp build_project_context(project) do
    %{
      id: project.id,
      name: project.name,
      slug: Map.get(project, :slug),
      description: project.description,
      status: project.status
    }
  end

  defp build_goal_tree(goals) do
    top_level = Enum.filter(goals, fn g -> is_nil(Map.get(g, :parent_id)) end)
    children_by_parent = Enum.group_by(goals, & &1.parent_id)

    Enum.map(top_level, fn goal ->
      %{
        id: goal.id,
        title: goal.title,
        timeframe: goal.timeframe,
        status: goal.status,
        children: build_goal_children(goal.id, children_by_parent)
      }
    end)
  end

  defp build_goal_children(parent_id, children_by_parent) do
    (children_by_parent[parent_id] || [])
    |> Enum.map(fn goal ->
      %{
        id: goal.id,
        title: goal.title,
        timeframe: goal.timeframe,
        status: goal.status
      }
    end)
  end

  defp format_tasks(tasks) do
    Enum.map(tasks, fn t ->
      %{
        id: t.id,
        title: t.title,
        status: t.status,
        priority: Map.get(t, :priority),
        effort: Map.get(t, :effort)
      }
    end)
  end

  defp format_proposals(proposals) do
    Enum.map(proposals, fn p ->
      %{
        id: p.id,
        title: p.title,
        status: p.status,
        summary: Map.get(p, :summary),
        confidence: Map.get(p, :confidence)
      }
    end)
  end

  # ── Private: Event Extraction ────────────────────────────────────────────────

  defp extract_project_id(event) do
    get_in(event, [:data, :project_id]) ||
      Map.get(event, :project_id)
  end

  defp extract_vault_query(event) do
    title = extract_event_title(event)
    type = to_string(Map.get(event, :type, ""))
    "#{type} #{title}" |> String.trim()
  end

  defp extract_event_title(event) do
    get_in(event, [:data, :title]) ||
      get_in(event, [:data, :name]) ||
      Map.get(event, :title) ||
      to_string(Map.get(event, :type, ""))
  end

  defp average([]), do: nil
  defp average(list), do: Enum.sum(list) / length(list)
end
