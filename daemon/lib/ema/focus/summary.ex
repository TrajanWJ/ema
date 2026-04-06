defmodule Ema.Focus.Summary do
  @moduledoc """
  Post-focus AI summary generation.
  Uses Claude Bridge (async) to summarize the session, then appends to today's journal entry.

  Migrated to Bridge.run_async/3 (Week 7 B3) — no longer blocks the focus timer GenServer.
  The AI call is fire-and-forget; result is delivered via callback.
  """

  require Logger

  alias Ema.Claude.Bridge
  alias Ema.{Focus, Journal, Tasks}

  @doc """
  Generate an AI summary for a completed focus session.
  Skips if session was very short (<5 min work).
  Returns {:ok, task_id} when the async request is dispatched, or :skip.
  """
  def maybe_generate(session, task_id) do
    session = Focus.get_session!(session.id)
    work_ms = Focus.session_elapsed_ms(session)

    # Skip for sessions under 5 minutes
    if work_ms < 5 * 60 * 1000 do
      Logger.debug("Focus.Summary: session too short (#{div(work_ms, 60_000)}m), skipping")
      :skip
    else
      generate_async(session, task_id, work_ms)
    end
  end

  # Migrated to async (Week 7 B3): Bridge.run_async/3 returns immediately.
  # The callback handles persisting the summary once Claude responds.
  defp generate_async(session, task_id, work_ms) do
    prompt = build_prompt(session, task_id, work_ms)

    callback = fn
      {:ok, result} ->
        summary = extract_text(result)
        save_summary(session, summary)
        append_to_journal(summary, work_ms)
        Logger.info("Focus.Summary: generated summary for session #{session.id}")

      {:error, reason} ->
        Logger.warning("Focus.Summary: AI generation failed: #{inspect(reason)}")
    end

    case Bridge.run_async(prompt, [model: "haiku", timeout: 30_000], callback) do
      {:ok, task_id_ai} ->
        Logger.debug(
          "Focus.Summary: dispatched async task #{task_id_ai} for session #{session.id}"
        )

        {:ok, task_id_ai}

      error ->
        Logger.warning("Focus.Summary: failed to dispatch async: #{inspect(error)}")
        error
    end
  end

  defp build_prompt(session, task_id, work_ms) do
    duration = format_duration(work_ms)
    blocks_count = length(session.blocks)
    work_blocks = Enum.count(session.blocks, &(&1.block_type == "work"))
    break_blocks = Enum.count(session.blocks, &(&1.block_type == "break"))

    task_context =
      case task_id && Tasks.get_task(task_id) do
        nil -> ""
        task -> "\nTask: #{task.title}\nTask description: #{task.description || "none"}\n"
      end

    """
    Generate a brief, encouraging focus session summary (2-3 sentences max).
    Keep it concise and personal — this goes into a daily journal.

    Session details:
    - Duration: #{duration} of focused work
    - Blocks: #{work_blocks} work, #{break_blocks} break (#{blocks_count} total)
    - Started: #{session.started_at}
    - Target: #{format_duration(session.target_ms)}
    #{task_context}
    Respond with ONLY the summary text, no JSON or formatting.
    """
  end

  defp extract_text(%{"result" => text}) when is_binary(text), do: String.trim(text)
  defp extract_text(%{"content" => text}) when is_binary(text), do: String.trim(text)
  defp extract_text(%{"raw" => text}) when is_binary(text), do: String.trim(text)
  defp extract_text(text) when is_binary(text), do: String.trim(text)

  defp extract_text(other) do
    Logger.debug("Focus.Summary: unexpected AI response shape: #{inspect(other)}")
    "Completed a focus session."
  end

  defp save_summary(session, summary) do
    session
    |> Focus.Session.changeset(%{summary: summary})
    |> Ema.Repo.update()
  end

  defp append_to_journal(summary, work_ms) do
    today = Date.utc_today() |> Date.to_iso8601()
    duration = format_duration(work_ms)

    case Journal.get_or_create_entry(today) do
      {:ok, entry} ->
        focus_block = "\n\n## Focus Session (#{duration})\n#{summary}"
        new_content = (entry.content || "") <> focus_block

        Journal.update_entry(today, %{content: new_content})

      {:error, reason} ->
        Logger.warning("Focus.Summary: journal append failed: #{inspect(reason)}")
    end
  end

  defp format_duration(ms) do
    total_min = div(ms, 60_000)
    hours = div(total_min, 60)
    mins = rem(total_min, 60)

    cond do
      hours > 0 -> "#{hours}h #{mins}m"
      true -> "#{mins}m"
    end
  end
end
