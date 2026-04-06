defmodule Mix.Tasks.Ema.Intents.Bootstrap do
  use Mix.Task

  @shortdoc "Import legacy intent data into the canonical intent tables"

  import Ecto.Query

  alias Ema.Intelligence.IntentNode
  alias Ema.Intents
  alias Ema.Repo
  alias Ecto.Adapters.SQL

  @moduledoc """
  Bootstrap the canonical intent tables from currently available legacy sources.

  Sources:
    - `intent_nodes`
    - `.superman/intents/`

  Usage:

      mix ema.intents.bootstrap
      mix ema.intents.bootstrap --dry-run
  """

  def run(args) do
    {opts, _rest, _invalid} = OptionParser.parse(args, switches: [dry_run: :boolean])
    dry_run = Keyword.get(opts, :dry_run, false)

    Mix.Task.run("app.start")
    ensure_intents_tables!()

    node_stats =
      if dry_run do
        %{found: count_legacy_nodes()}
      else
        import_legacy_nodes()
      end

    folder_stats =
      if dry_run do
        %{found: length(intent_folder_paths())}
      else
        import_intent_folders()
      end

    Mix.shell().info("""
    Intent bootstrap #{if dry_run, do: "preview", else: "complete"}:
      legacy_nodes   #{format_stats(node_stats)}
      intent_folders #{format_stats(folder_stats)}
    """)
  end

  defp count_legacy_nodes do
    Repo.aggregate(IntentNode, :count)
  rescue
    _ -> 0
  end

  defp ensure_intents_tables! do
    SQL.query!(Repo, """
    CREATE TABLE IF NOT EXISTS intents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      level INTEGER NOT NULL DEFAULT 4,
      kind TEXT NOT NULL DEFAULT 'task',
      parent_id TEXT REFERENCES intents(id) ON DELETE SET NULL,
      project_id TEXT,
      source_fingerprint TEXT,
      source_type TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'planned',
      phase INTEGER DEFAULT 1,
      completion_pct INTEGER DEFAULT 0,
      clarity REAL DEFAULT 0.0,
      energy REAL DEFAULT 0.0,
      priority INTEGER DEFAULT 3,
      confidence REAL DEFAULT 1.0,
      provenance_class TEXT DEFAULT 'high',
      confirmed_at TEXT,
      tags TEXT,
      metadata TEXT,
      inserted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
    """)

    SQL.query!(Repo, """
    CREATE TABLE IF NOT EXISTS intent_links (
      id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL REFERENCES intents(id) ON DELETE CASCADE,
      linkable_type TEXT NOT NULL,
      linkable_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'related',
      provenance TEXT DEFAULT 'manual',
      inserted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
    """)

    SQL.query!(Repo, """
    CREATE TABLE IF NOT EXISTS intent_events (
      id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL REFERENCES intents(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload TEXT,
      actor TEXT NOT NULL DEFAULT 'system',
      inserted_at TEXT NOT NULL
    )
    """)

    SQL.query!(Repo, "CREATE UNIQUE INDEX IF NOT EXISTS intents_slug_index ON intents(slug)")
    SQL.query!(Repo, "CREATE UNIQUE INDEX IF NOT EXISTS intents_source_fingerprint_index ON intents(source_fingerprint) WHERE source_fingerprint IS NOT NULL")
    SQL.query!(Repo, "CREATE INDEX IF NOT EXISTS intents_parent_id_index ON intents(parent_id)")
    SQL.query!(Repo, "CREATE INDEX IF NOT EXISTS intents_project_id_index ON intents(project_id)")
    SQL.query!(Repo, "CREATE INDEX IF NOT EXISTS intent_links_intent_id_index ON intent_links(intent_id)")
    SQL.query!(Repo, "CREATE UNIQUE INDEX IF NOT EXISTS intent_links_unique_triple ON intent_links(intent_id, linkable_type, linkable_id)")
    SQL.query!(Repo, "CREATE INDEX IF NOT EXISTS intent_events_intent_id_index ON intent_events(intent_id)")
  end

  defp import_legacy_nodes do
    Repo.all(from n in IntentNode, order_by: [asc: n.inserted_at])
    |> Enum.reduce(%{created: 0, skipped: 0, errors: 0}, fn node, acc ->
      attrs = %{
        id: node.id,
        title: node.title,
        description: node.description,
        level: min(max(node.level, 0), 5),
        kind: "task",
        parent_id: normalize_parent_id(node.parent_id),
        project_id: node.project_id,
        source_type: "manual",
        source_fingerprint: "legacy_node:#{node.id}",
        status: map_legacy_status(node.status),
        provenance_class: "high",
        metadata: Jason.encode!(%{
          imported_from: "intent_nodes",
          linked_wiki_path: node.linked_wiki_path,
          linked_task_ids: decode_json(node.linked_task_ids, [])
        })
      }

      case upsert_intent(attrs) do
        :created -> bump_stats(acc, :created)
        :skipped -> bump_stats(acc, :skipped)
        {:error, _reason} -> Map.update!(acc, :errors, &(&1 + 1))
      end
    end)
  end

  defp import_intent_folders do
    intent_folder_paths()
    |> Enum.reduce(%{created: 0, skipped: 0}, fn dir, acc ->
      slug = Path.basename(dir)

      attrs = %{
        title: read_folder_title(dir, slug),
        slug: slug,
        description: read_folder_body(dir),
        level: 5,
        kind: "task",
        source_type: "manual",
        source_fingerprint: "intent_folder:#{slug}",
        status: read_folder_status(dir),
        provenance_class: "medium",
        metadata: Jason.encode!(%{
          imported_from: "intent_folder",
          path: dir
        })
      }

      bump_stats(acc, upsert_intent(attrs))
    end)
  end

  defp upsert_intent(attrs) do
    case Intents.get_intent_by_fingerprint(attrs.source_fingerprint) do
      nil ->
        case Intents.create_intent(attrs) do
          {:ok, intent} ->
            _ = Intents.emit_event(intent.id, "imported", %{source: attrs.source_fingerprint}, "migration")
            :created

          {:error, reason} ->
            {:error, reason}
        end

      _ ->
        :skipped
    end
  end

  defp bump_stats(acc, :created), do: Map.update!(acc, :created, &(&1 + 1))
  defp bump_stats(acc, :skipped), do: Map.update!(acc, :skipped, &(&1 + 1))

  defp intent_folder_paths do
    candidate_bases()
    |> Enum.flat_map(fn base ->
      case File.ls(base) do
        {:ok, entries} ->
          entries
          |> Enum.map(&Path.join(base, &1))
          |> Enum.filter(&File.dir?/1)

        _ ->
          []
      end
    end)
    |> Enum.uniq()
  end

  defp candidate_bases do
    cwd = File.cwd!()

    [
      Path.expand(".superman/intents", cwd),
      Path.expand("../.superman/intents", cwd)
    ]
  end

  defp read_folder_title(dir, fallback_slug) do
    case File.read(Path.join(dir, "intent.md")) do
      {:ok, content} ->
        case Regex.run(~r/^#\s+(.+)$/m, content, capture: :all_but_first) do
          [title] -> title
          _ -> humanize_slug(fallback_slug)
        end

      _ ->
        humanize_slug(fallback_slug)
    end
  end

  defp read_folder_body(dir) do
    case File.read(Path.join(dir, "intent.md")) do
      {:ok, content} -> content
      _ -> nil
    end
  end

  defp read_folder_status(dir) do
    case File.read(Path.join(dir, "status.json")) do
      {:ok, raw} ->
        case Jason.decode(raw) do
          {:ok, %{"status" => "complete"}} -> "complete"
          {:ok, %{"status" => "active"}} -> "active"
          {:ok, %{"status" => "blocked"}} -> "blocked"
          _ -> "planned"
        end

      _ ->
        "planned"
    end
  end

  defp decode_json(nil, fallback), do: fallback
  defp decode_json(raw, fallback) do
    case Jason.decode(raw) do
      {:ok, decoded} -> decoded
      _ -> fallback
    end
  end

  defp map_legacy_status("complete"), do: "complete"
  defp map_legacy_status("partial"), do: "active"
  defp map_legacy_status(_), do: "planned"

  defp humanize_slug(slug), do: slug |> String.replace("-", " ") |> String.trim()

  defp normalize_parent_id(nil), do: nil
  defp normalize_parent_id(parent_id) do
    if Intents.get_intent(parent_id), do: parent_id, else: nil
  rescue
    _ -> nil
  end

  defp format_stats(stats) do
    stats
    |> Enum.map(fn {k, v} -> "#{k}=#{v}" end)
    |> Enum.join(", ")
  end
end
