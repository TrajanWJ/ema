# Import existing intent data into the new intents table.
#
# Usage: mix run priv/repo/seeds/import_intents.exs
#
# Idempotent — uses source_fingerprint to skip duplicates on re-run.

alias Ema.Repo
alias Ema.Intents
alias Ema.Intents.Intent

defmodule IntentImporter do
  @superman_dir Path.expand("daemon/.superman/intents", Path.join(__DIR__, "../../../.."))

  # ── Part A: Import from intent_nodes table ────────────────────────

  def import_intent_nodes do
    case table_exists?("intent_nodes") do
      false ->
        IO.puts("  intent_nodes table does not exist — skipping")
        {0, 0}

      true ->
        rows = Repo.query!("SELECT * FROM intent_nodes")
        columns = Enum.map(rows.columns, &String.to_atom/1)
        records = Enum.map(rows.rows, fn row -> Enum.zip(columns, row) |> Map.new() end)

        Enum.reduce(records, {0, 0}, fn row, {imported, skipped} ->
          fingerprint = "intent_node:#{row[:id]}"

          case Intents.get_intent_by_fingerprint(fingerprint) do
            %Intent{} ->
              {imported, skipped + 1}

            nil ->
              attrs = %{
                title: row[:title] || "Untitled",
                description: row[:description],
                level: row[:level] || 4,
                status: map_old_status(row[:status]),
                parent_id: row[:parent_id],
                project_id: row[:project_id],
                source_type: "manual",
                source_fingerprint: fingerprint,
                provenance_class: "high",
                kind: "task"
              }

              case Intents.create_intent(attrs) do
                {:ok, intent} ->
                  Intents.emit_event(intent.id, "imported", %{
                    source: "intent_nodes",
                    original_id: row[:id]
                  }, "migration")

                  # Link any associated tasks
                  link_tasks(intent.id, row[:linked_task_ids])
                  {imported + 1, skipped}

                {:error, changeset} ->
                  IO.puts("  WARN: failed to import intent_node #{row[:id]}: #{inspect(changeset.errors)}")
                  {imported, skipped}
              end
          end
        end)
    end
  end

  defp table_exists?(table_name) do
    case Repo.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table_name]) do
      {:ok, %{rows: [_ | _]}} -> true
      _ -> false
    end
  end

  defp map_old_status("partial"), do: "implementing"
  defp map_old_status("complete"), do: "complete"
  defp map_old_status("planned"), do: "planned"
  defp map_old_status(nil), do: "planned"
  defp map_old_status(other), do: if(other in ~w(planned active researched outlined implementing complete blocked archived), do: other, else: "planned")

  defp link_tasks(_intent_id, nil), do: :ok
  defp link_tasks(intent_id, json) when is_binary(json) do
    case Jason.decode(json) do
      {:ok, ids} when is_list(ids) ->
        Enum.each(ids, fn task_id ->
          Intents.link_intent(intent_id, "task", to_string(task_id), role: "derived", provenance: "import")
        end)

      _ ->
        :ok
    end
  end
  defp link_tasks(_intent_id, _), do: :ok

  # ── Part B: Import from .superman/intents/ folders ────────────────

  def import_superman_folders do
    case File.ls(@superman_dir) do
      {:error, _} ->
        IO.puts("  .superman/intents/ directory not found — skipping")
        {0, 0}

      {:ok, entries} ->
        dirs =
          entries
          |> Enum.filter(fn entry ->
            File.dir?(Path.join(@superman_dir, entry))
          end)
          |> Enum.sort()

        Enum.reduce(dirs, {0, 0}, fn dir_name, {imported, skipped} ->
          fingerprint = "superman:#{dir_name}"
          intent_md = Path.join([@superman_dir, dir_name, "intent.md"])
          status_json = Path.join([@superman_dir, dir_name, "status.json"])

          case Intents.get_intent_by_fingerprint(fingerprint) do
            %Intent{} ->
              {imported, skipped + 1}

            nil ->
              case File.read(intent_md) do
                {:error, _} ->
                  # No intent.md — skip empty folders
                  {imported, skipped}

                {:ok, content} ->
                  {title, description} = parse_intent_md(content, dir_name)
                  status_data = read_status_json(status_json)

                  attrs = %{
                    title: title,
                    slug: dir_name,
                    description: description,
                    level: 5,
                    kind: infer_kind(dir_name, title),
                    source_type: "brain_dump",
                    source_fingerprint: fingerprint,
                    provenance_class: "medium",
                    status: status_data[:status] || "planned",
                    phase: status_data[:phase] || 1,
                    clarity: status_data[:clarity] || 0.0,
                    energy: status_data[:energy] || 0.0,
                    completion_pct: status_data[:completion_pct] || 0
                  }

                  case Intents.create_intent(attrs) do
                    {:ok, intent} ->
                      Intents.emit_event(intent.id, "imported", %{
                        source: "superman_folder",
                        folder: dir_name
                      }, "migration")
                      {imported + 1, skipped}

                    {:error, changeset} ->
                      IO.puts("  WARN: failed to import superman/#{dir_name}: #{inspect(changeset.errors)}")
                      {imported, skipped}
                  end
              end
          end
        end)
    end
  end

  defp parse_intent_md(content, fallback_slug) do
    lines = String.split(content, "\n", trim: false)

    case lines do
      [heading | rest] ->
        # Check if heading has inline title: "# Intent: Some Title"
        inline_title =
          cond do
            String.starts_with?(heading, "# Intent:") ->
              heading |> String.replace_leading("# Intent:", "") |> String.trim()

            true ->
              nil
          end

        # Get body content (everything after blank lines following heading)
        body_lines =
          rest
          |> Enum.drop_while(&(String.trim(&1) == ""))

        {body_title, description} = extract_body(body_lines)

        title =
          case inline_title do
            nil -> body_title || humanize_slug(fallback_slug)
            "" -> body_title || humanize_slug(fallback_slug)
            t -> t
          end

        # Truncate title to 120 chars, use full text as description if long
        title = truncate_title(title)
        {title, description}

      [] ->
        {humanize_slug(fallback_slug), nil}
    end
  end

  defp extract_body([]), do: {nil, nil}
  defp extract_body([first | remaining]) do
    cond do
      String.starts_with?(first, "## Description") ->
        desc_text =
          remaining
          |> Enum.drop_while(&(String.trim(&1) == ""))
          |> Enum.take_while(&(!String.starts_with?(&1, "## ")))
          |> Enum.join("\n")
          |> String.trim()

        title = truncate_title(desc_text)
        desc = if(String.length(desc_text) > 120, do: desc_text, else: nil)
        {title, desc}

      String.starts_with?(first, "## ") ->
        # Structured sections — collect all text as description
        all_text =
          [first | remaining]
          |> Enum.join("\n")
          |> String.trim()

        title = first |> String.replace_leading("## ", "") |> String.trim()
        {title, all_text}

      true ->
        # Plain text body — first line (or sentence) is title, full text is description
        full_text =
          [first | remaining]
          |> Enum.join("\n")
          |> String.trim()

        title = first |> String.trim()
        desc = if(String.length(full_text) > 120, do: full_text, else: nil)
        {title, desc}
    end
  end

  defp truncate_title(nil), do: nil
  defp truncate_title(text) do
    text
    |> String.split(~r/[.!?\n]/, parts: 2)
    |> hd()
    |> String.trim()
    |> String.slice(0, 120)
  end

  defp read_status_json(path) do
    case File.read(path) do
      {:ok, content} ->
        case Jason.decode(content) do
          {:ok, data} ->
            %{
              status: map_old_status(data["status"]),
              phase: data["phase"],
              clarity: data["clarity"],
              energy: data["energy"],
              completion_pct: data["completion_pct"]
            }

          _ ->
            %{}
        end

      {:error, _} ->
        %{}
    end
  end

  defp infer_kind(slug, _title) do
    cond do
      String.starts_with?(slug, "audit-") -> "audit"
      String.starts_with?(slug, "research-") -> "exploration"
      String.starts_with?(slug, "fix-") -> "fix"
      true -> "task"
    end
  end

  defp humanize_slug(slug) do
    slug
    |> String.replace("-", " ")
    |> String.split()
    |> Enum.map_join(" ", &String.capitalize/1)
    |> String.slice(0, 120)
  end

  # ── Part C: Bootstrap intent for Intent Engine itself ─────────────

  def create_bootstrap_intent do
    fingerprint = "bootstrap:intent-engine"

    case Intents.get_intent_by_fingerprint(fingerprint) do
      %Intent{} = existing ->
        IO.puts("  Bootstrap intent already exists (#{existing.id}) — skipping")
        :skipped

      nil ->
        project_id = find_ema_project_id()

        {:ok, root} =
          Intents.create_intent(%{
            title: "Build EMA Intent Engine",
            level: 2,
            kind: "task",
            status: "active",
            project_id: project_id,
            source_type: "manual",
            source_fingerprint: fingerprint,
            provenance_class: "high"
          })

        Intents.emit_event(root.id, "imported", %{source: "bootstrap"}, "migration")

        children = [
          {"Unified Intent Schema", "complete", "bootstrap:unified-intent-schema"},
          {"Vault Convergence", "planned", "bootstrap:vault-convergence"},
          {"Wikipedia Frontend", "planned", "bootstrap:wikipedia-frontend"},
          {"CLI + Agent Ingestion", "planned", "bootstrap:cli-agent-ingestion"},
          {"LaunchpadHQ Sprint 2", "planned", "bootstrap:launchpadhq-sprint-2"}
        ]

        Enum.each(children, fn {title, status, fp} ->
          case Intents.get_intent_by_fingerprint(fp) do
            %Intent{} ->
              :ok

            nil ->
              {:ok, child} =
                Intents.create_intent(%{
                  title: title,
                  level: 3,
                  kind: "task",
                  status: status,
                  parent_id: root.id,
                  project_id: project_id,
                  source_type: "manual",
                  source_fingerprint: fp,
                  provenance_class: "high"
                })

              Intents.emit_event(child.id, "imported", %{source: "bootstrap", parent: root.id}, "migration")
          end
        end)

        :created
    end
  end

  defp find_ema_project_id do
    case Repo.query("SELECT id FROM projects WHERE slug = 'ema' OR name LIKE '%EMA%' LIMIT 1") do
      {:ok, %{rows: [[id]]}} -> id
      _ -> nil
    end
  end
end

# ── Run ──────────────────────────────────────────────────────────────

IO.puts("\n=== Intent Import Script ===\n")

IO.puts("[1/3] Importing from intent_nodes table...")
{nodes_imported, nodes_skipped} = IntentImporter.import_intent_nodes()
IO.puts("  -> #{nodes_imported} imported, #{nodes_skipped} skipped (duplicates)\n")

IO.puts("[2/3] Importing from .superman/intents/ folders...")
{folders_imported, folders_skipped} = IntentImporter.import_superman_folders()
IO.puts("  -> #{folders_imported} imported, #{folders_skipped} skipped (duplicates)\n")

IO.puts("[3/3] Creating bootstrap intent tree...")
case IntentImporter.create_bootstrap_intent() do
  :created -> IO.puts("  -> Created root + 5 children\n")
  :skipped -> IO.puts("  -> Already exists — skipped\n")
end

IO.puts("=== Summary ===")
IO.puts("  intent_nodes:     #{nodes_imported} imported, #{nodes_skipped} skipped")
IO.puts("  superman folders: #{folders_imported} imported, #{folders_skipped} skipped")
IO.puts("  bootstrap tree:   created")
total = nodes_imported + folders_imported
IO.puts("  total new:        #{total}")
IO.puts("")
