defmodule Ema.IntentionFarmer.NoteEmitter do
  @moduledoc "Creates or updates vault notes from harvested sessions and imports."

  require Logger

  alias Ema.IntentionFarmer
  alias Ema.IntentionFarmer.HarvestedSession
  alias Ema.SecondBrain

  def emit(%HarvestedSession{} = session) do
    intents = IntentionFarmer.list_intents(harvested_session_id: session.id, limit: 25)
    note_path = note_path_for(session)
    title = title_for(session)
    body = render_body(session, intents)

    if already_emitted?(session, note_path) do
      {:ok, note_path}
    else
      attrs = %{
        file_path: note_path,
        title: title,
        space: note_space(note_path),
        source_type: "session",
        source_id: "harvested_session:#{session.id}",
        tags: tags_for(session, intents),
        content: body,
        metadata: note_metadata(session, intents),
        project_id: session.project_id
      }

      result =
        case SecondBrain.get_note_by_path(note_path) do
          nil -> SecondBrain.create_note(attrs)
          note -> SecondBrain.update_note(note.id, Map.delete(attrs, :file_path))
        end

      case result do
        {:ok, _note} ->
          mark_session_emitted(session, note_path)
          {:ok, note_path}

        {:error, reason} = error ->
          Logger.warning("[IntentionFarmer.NoteEmitter] Failed to emit note for #{session.id}: #{inspect(reason)}")
          error
      end
    end
  end

  def emit_batch(sessions) when is_list(sessions) do
    Enum.reduce(sessions, %{emitted: 0, failed: 0}, fn session, acc ->
      case emit(session) do
        {:ok, _path} -> %{acc | emitted: acc.emitted + 1}
        _ -> %{acc | failed: acc.failed + 1}
      end
    end)
  end

  defp render_body(session, intents) do
    frontmatter = %{
      source_type: session.source_type,
      session_id: session.session_id,
      project_path: session.project_path,
      model: session.model,
      model_provider: session.model_provider,
      started_at: format_dt(session.started_at),
      ended_at: format_dt(session.ended_at),
      raw_path: session.raw_path
    }

    """
    ---
    #{yaml_map(frontmatter)}
    ---

    # #{title_for(session)}

    #{summary_for(session, intents)}

    ## Intents

    #{render_intents(intents)}

    ## Session Facts

    - Source type: `#{session.source_type}`
    - Model provider: `#{session.model_provider || "unknown"}`
    - Message count: #{session.message_count || 0}
    - Tool calls: #{session.tool_call_count || 0}
    - Token count: #{session.token_count || 0}
    - Files touched: #{length(session.files_touched || [])}

    ## Files Touched

    #{render_files(session.files_touched || [])}

    ## Raw Source

    - Path: `#{session.raw_path}`
    """
  end

  defp summary_for(session, intents) do
    project_ref =
      case project_label(session) do
        nil -> "Unlinked project"
        label -> "Linked project [[#{label}]]"
      end

    intent_summary =
      case intents do
        [] -> "No explicit intents extracted."
        _ -> "#{length(intents)} intent(s) extracted from this artifact."
      end

    "#{project_ref}. #{intent_summary}"
  end

  defp render_intents([]), do: "- No extracted intents."

  defp render_intents(intents) do
    Enum.map_join(intents, "\n", fn intent ->
      "- **#{intent.intent_type}**: #{intent.content}"
    end)
  end

  defp render_files([]), do: "- No files recorded."

  defp render_files(files) do
    Enum.map_join(files, "\n", fn path -> "- `#{path}`" end)
  end

  defp note_path_for(session) do
    date =
      session.started_at ||
        session.inserted_at ||
        DateTime.utc_now()

    folder =
      case session.source_type do
        "external_import" -> "Imports/Staged"
        "claude_task" -> "Agents/ClaudeTasks"
        "codex_history" -> "Agents/CodexHistory"
        _ -> "Agents/Sessions"
      end

    slug =
      [session.source_type, session.session_id || session.id]
      |> Enum.reject(&is_nil/1)
      |> Enum.join("-")
      |> slugify()

    Path.join([
      folder,
      Integer.to_string(date.year),
      "#{Date.to_iso8601(DateTime.to_date(date))}-#{slug}.md"
    ])
  end

  defp note_space(path) do
    path
    |> String.split("/", parts: 2)
    |> List.first()
  end

  defp title_for(session) do
    base =
      session.session_id ||
        session.id

    "#{session.source_type} #{base}"
  end

  defp tags_for(session, intents) do
    base_tags = ["session", session.source_type]
    intent_tags = Enum.map(intents, & &1.intent_type)

    (base_tags ++ intent_tags)
    |> Enum.uniq()
  end

  defp note_metadata(session, intents) do
    %{
      "harvested_session_id" => session.id,
      "source_type" => session.source_type,
      "intent_types" => Enum.map(intents, & &1.intent_type),
      "raw_path" => session.raw_path,
      "project_path" => session.project_path
    }
  end

  defp mark_session_emitted(session, note_path) do
    metadata =
      (session.metadata || %{})
      |> Map.put("note_emitted_at", DateTime.utc_now() |> DateTime.to_iso8601())
      |> Map.put("note_path", note_path)

    IntentionFarmer.update_session(session, %{metadata: metadata})
  rescue
    _ -> :ok
  end

  defp yaml_map(map) do
    map
    |> Enum.reject(fn {_k, v} -> is_nil(v) end)
    |> Enum.map_join("\n", fn {k, v} -> "#{k}: #{yaml_value(v)}" end)
  end

  defp yaml_value(v) when is_binary(v), do: inspect(v)
  defp yaml_value(v), do: inspect(v)

  defp format_dt(nil), do: nil
  defp format_dt(%DateTime{} = dt), do: DateTime.to_iso8601(dt)

  defp project_label(%{project_path: nil}), do: nil
  defp project_label(%{project_path: path}), do: Path.basename(path)

  defp already_emitted?(session, note_path) do
    Map.get(session.metadata || %{}, "note_path") == note_path and
      SecondBrain.get_note_by_path(note_path) != nil
  end

  defp slugify(text) do
    text
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/, "-")
    |> String.trim("-")
  end
end
