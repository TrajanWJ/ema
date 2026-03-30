# Import Claude Code sessions from ~/.claude/projects/ into EMA
# Run with: mix run scripts/import-claude-sessions.exs

alias Ema.Repo
alias Ema.Projects.Project
alias Ema.ClaudeSessions.ClaudeSession

require Logger

# Path to Claude projects directory (on the local host machine)
claude_projects_dir = System.get_env("HOME") <> "/.claude/projects"

defmodule ClaudeImporter do
  @doc """
  Decode Claude's directory-encoded project slug back to a file path.
  e.g. "-home-trajan-Desktop-Coding-Projects-ema" -> "/home/trajan/Desktop/Coding/Projects/ema"
  """
  def decode_path(slug) do
    home = System.get_env("HOME", "/home/trajan")
    home_slug = String.replace(home, "/", "-")

    if String.starts_with?(slug, home_slug) do
      rest = String.replace_prefix(slug, home_slug, "")
      home <> String.replace(rest, "-", "/")
    else
      "/" <> String.replace(slug, ~r/^-/, "") |> String.replace("-", "/")
    end
  end

  @doc """
  Extract metadata from a JSONL session file.
  """
  def parse_session_file(path) do
    lines =
      case File.read(path) do
        {:ok, content} -> String.split(content, "\n", trim: true)
        _ -> []
      end

    entries =
      Enum.reduce(lines, [], fn line, acc ->
        case Jason.decode(line) do
          {:ok, entry} -> [entry | acc]
          _ -> acc
        end
      end)
      |> Enum.reverse()

    timestamps =
      entries
      |> Enum.filter(&Map.has_key?(&1, "timestamp"))
      |> Enum.map(& &1["timestamp"])
      |> Enum.filter(& &1)

    started_at = List.first(timestamps)
    ended_at = List.last(timestamps)

    summary =
      entries
      |> Enum.find(fn e -> e["type"] == "user" end)
      |> case do
        nil -> nil
        entry ->
          content = get_in(entry, ["message", "content"])
          cond do
            is_binary(content) -> String.slice(content, 0, 200)
            is_list(content) ->
              Enum.find_value(content, fn
                %{"type" => "text", "text" => text} -> text
                _ -> nil
              end)
              |> case do
                nil -> nil
                text -> String.slice(text, 0, 200)
              end
            true -> nil
          end
      end

    tool_calls =
      Enum.count(entries, fn e ->
        case get_in(e, ["message", "content"]) do
          content when is_list(content) ->
            Enum.any?(content, & &1["type"] == "tool_use")
          _ -> false
        end
      end)

    files_touched =
      entries
      |> Enum.flat_map(fn e ->
        case get_in(e, ["message", "content"]) do
          content when is_list(content) ->
            content
            |> Enum.filter(& &1["type"] == "tool_use")
            |> Enum.flat_map(fn tool ->
              input = tool["input"] || %{}
              [input["file_path"], input["path"], input["notebook_path"]]
              |> Enum.filter(&(is_binary(&1) and String.starts_with?(&1, "/")))
            end)
          _ -> []
        end
      end)
      |> Enum.uniq()
      |> Enum.take(50)

    token_count =
      Enum.reduce(entries, 0, fn e, acc ->
        usage = get_in(e, ["message", "usage"])
        if is_map(usage) do
          acc + (usage["output_tokens"] || 0) + (usage["input_tokens"] || 0)
        else
          acc
        end
      end)

    %{
      started_at: parse_timestamp(started_at),
      ended_at: parse_timestamp(ended_at),
      summary: summary,
      token_count: token_count,
      tool_calls: tool_calls,
      files_touched: files_touched
    }
  end

  defp parse_timestamp(nil), do: nil
  defp parse_timestamp(ts) do
    case DateTime.from_iso8601(ts) do
      {:ok, dt, _} -> DateTime.truncate(dt, :second)
      _ -> nil
    end
  end

  def generate_id do
    :crypto.strong_rand_bytes(6) |> Base.encode16(case: :lower)
  end

  def path_to_slug(path) do
    path
    |> Path.basename()
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/, "-")
    |> String.trim("-")
  end

  def path_to_name(path) do
    path
    |> Path.basename()
    |> String.split(~r/[-_]/)
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end
end

Logger.info("Starting Claude session import from #{claude_projects_dir}")

project_dirs =
  case File.ls(claude_projects_dir) do
    {:ok, dirs} -> dirs
    {:error, reason} ->
      Logger.error("Cannot read #{claude_projects_dir}: #{inspect(reason)}")
      []
  end

Logger.info("Found #{length(project_dirs)} project directories")

results =
  Enum.map(project_dirs, fn dir_name ->
    project_path = ClaudeImporter.decode_path(dir_name)
    slug = ClaudeImporter.path_to_slug(project_path)
    name = ClaudeImporter.path_to_name(project_path)

    Logger.info("Processing project: #{name} (#{project_path})")

    project =
      case Repo.get_by(Project, slug: slug) do
        nil ->
          attrs = %{
            id: ClaudeImporter.generate_id(),
            slug: slug,
            name: name,
            description: "Imported from Claude Code sessions",
            status: "active",
            linked_path: project_path,
            settings: %{
              imported_from: "claude_code",
              import_date: DateTime.utc_now() |> DateTime.to_iso8601()
            }
          }

          case Repo.insert(Project.changeset(%Project{}, attrs)) do
            {:ok, p} ->
              Logger.info("  ✓ Created project: #{name}")
              p

            {:error, changeset} ->
              Logger.warning("  ✗ Failed to create project #{name}: #{inspect(changeset.errors)}")
              nil
          end

        existing ->
          Logger.info("  → Project already exists: #{name}")
          existing
      end

    session_dir = Path.join(claude_projects_dir, dir_name)

    session_files =
      case File.ls(session_dir) do
        {:ok, files} -> Enum.filter(files, &String.ends_with?(&1, ".jsonl"))
        _ -> []
      end

    sessions_created =
      if project do
        Enum.reduce(session_files, 0, fn file, count ->
          session_id = Path.rootname(file)
          file_path = Path.join(session_dir, file)

          case Repo.get_by(ClaudeSession, session_id: session_id) do
            nil ->
              meta = ClaudeImporter.parse_session_file(file_path)

              attrs = %{
                id: ClaudeImporter.generate_id(),
                session_id: session_id,
                project_path: project_path,
                project_id: project.id,
                raw_path: file_path,
                started_at: meta.started_at,
                ended_at: meta.ended_at,
                last_active: meta.ended_at || meta.started_at,
                summary: meta.summary,
                token_count: meta.token_count,
                tool_calls: meta.tool_calls,
                files_touched: meta.files_touched,
                status: "completed",
                metadata: %{imported: true, import_source: "migration_script"}
              }

              case Repo.insert(ClaudeSession.changeset(%ClaudeSession{}, attrs)) do
                {:ok, _} ->
                  count + 1

                {:error, cs} ->
                  Logger.warning("  ✗ Failed session #{session_id}: #{inspect(cs.errors)}")
                  count
              end

            _ ->
              count
          end
        end)
      else
        0
      end

    {name, length(session_files), sessions_created}
  end)

total_sessions = Enum.sum(Enum.map(results, fn {_, _, created} -> created end))

Logger.info("\n=== Import Complete ===")
Logger.info("Projects processed: #{length(results)}")
Logger.info("Sessions imported: #{total_sessions}")

Enum.each(results, fn {name, total, created} ->
  Logger.info("  #{name}: #{created}/#{total} sessions imported")
end)
