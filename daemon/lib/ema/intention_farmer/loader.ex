defmodule Ema.IntentionFarmer.Loader do
  @moduledoc "Loads cleaned harvest data into EMA systems. Each operation is idempotent."

  require Logger

  alias Ema.IntentionFarmer
  alias Ema.ClaudeSessions
  alias Ema.ClaudeSessions.SessionLinker

  @doc """
  Load a single cleaned+parsed session result into all EMA systems.
  Returns {:ok, %{session: hs, intents_loaded: n, claude_session: cs_or_nil}} or {:error, reason}
  """
  def load(parsed_result) do
    with {:ok, hs} <- load_session(parsed_result),
         {:ok, cs} <- maybe_load_claude_session(parsed_result, hs),
         {:ok, intents_loaded} <- load_intents(parsed_result, hs) do
      broadcast_events(hs, intents_loaded)

      {:ok, %{session: hs, intents_loaded: intents_loaded, claude_session: cs}}
    end
  end

  @doc """
  Bulk load a list of cleaned results. Returns summary stats.
  Throttles to avoid SQLite write contention -- 10ms sleep between each.
  """
  def load_batch(results) do
    Enum.reduce(results, %{loaded: 0, skipped: 0, failed: 0, intents: 0, sessions: []}, fn result,
                                                                                             acc ->
      case load(result) do
        {:ok, %{intents_loaded: n, session: session}} ->
          Process.sleep(10)
          %{acc | loaded: acc.loaded + 1, intents: acc.intents + n, sessions: [session | acc.sessions]}

        {:error, :already_exists} ->
          %{acc | skipped: acc.skipped + 1}

        {:error, reason} ->
          Logger.warning("[IntentionFarmer.Loader] Failed to load session: #{inspect(reason)}")
          %{acc | failed: acc.failed + 1}
      end
    end)
    |> Map.update!(:sessions, &Enum.reverse/1)
  end

  # --- Private ---

  defp load_session(parsed) do
    fingerprint = parsed[:source_fingerprint] || parsed.source_fingerprint

    if IntentionFarmer.session_exists?(fingerprint) do
      {:error, :already_exists}
    else
      IntentionFarmer.create_session(%{
        session_id: parsed.session_id,
        source_type: parsed.source_type,
        raw_path: parsed.raw_path,
        project_path: parsed.project_path,
        model: parsed[:model],
        model_provider: parsed[:model_provider],
        started_at: parsed[:started_at],
        ended_at: parsed[:ended_at],
        status: parsed[:status] || "processed",
        quality_score: parsed[:quality_score] || 0.0,
        message_count: parsed[:message_count] || 0,
        tool_call_count: parsed[:tool_call_count] || 0,
        token_count: parsed[:token_count] || 0,
        files_touched: parsed[:files_touched] || [],
        source_fingerprint: fingerprint,
        metadata: parsed[:metadata] || %{},
        project_id: resolve_project_id(parsed)
      })
    end
  end

  defp maybe_load_claude_session(%{source_type: "claude_code"} = parsed, hs) do
    id =
      "cs_#{System.system_time(:millisecond)}_#{:crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)}"

    case ClaudeSessions.create_session(%{
           id: id,
           session_id: parsed.session_id,
           project_path: parsed.project_path,
           started_at: parsed[:started_at],
           ended_at: parsed[:ended_at],
           status: "completed",
           token_count: parsed[:token_count] || 0,
           tool_calls: parsed[:tool_call_count] || 0,
           files_touched: parsed[:files_touched] || [],
           raw_path: parsed.raw_path,
           metadata: %{harvested: true, harvested_session_id: hs.id},
           project_id: hs.project_id
         }) do
      {:ok, cs} ->
        IntentionFarmer.update_session(hs, %{claude_session_id: cs.id})
        {:ok, cs}

      {:error, _reason} ->
        # May already exist -- that's fine
        {:ok, nil}
    end
  end

  defp maybe_load_claude_session(_parsed, _hs), do: {:ok, nil}

  defp load_intents(parsed, hs) do
    intents = parsed[:intents] || []

    loaded_count =
      Enum.count(intents, fn intent ->
        fingerprint =
          intent[:source_fingerprint] ||
            Ema.IntentionFarmer.Cleaner.intent_fingerprint(
              intent.content,
              intent.source_type,
              parsed.session_id
            )

        if IntentionFarmer.intent_exists?(fingerprint) do
          false
        else
          case IntentionFarmer.create_intent(%{
                 content: intent.content,
                 intent_type: intent.intent_type,
                 source_type: intent.source_type,
                 source_fingerprint: fingerprint,
                 quality_score: parsed[:quality_score] || 0.0,
                 harvested_session_id: hs.id,
                 project_id: hs.project_id,
                 metadata: %{}
               }) do
            {:ok, _hi} -> true
            {:error, _} -> false
          end
        end
      end)

    {:ok, loaded_count}
  end

  defp resolve_project_id(parsed) do
    case parsed[:project_path] do
      nil ->
        nil

      path ->
        case SessionLinker.link(%{project_path: path}) do
          {:ok, project_id} -> project_id
          :unlinked -> nil
        end
    end
  end

  defp broadcast_events(hs, intents_loaded) do
    Ema.Pipes.EventBus.broadcast_event("intention_farmer:session_harvested", %{
      session_id: hs.id,
      source_type: hs.source_type,
      project_path: hs.project_path,
      intents_loaded: intents_loaded
    })

    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "intention_farmer:events",
      {:session_harvested,
       %{session_id: hs.id, source_type: hs.source_type, intents_loaded: intents_loaded}}
    )
  end
end
