defmodule EmaWeb.VoiceController do
  use EmaWeb, :controller

  alias Ema.Voice.VoiceCore

  action_fallback EmaWeb.FallbackController

  def sessions(conn, _params) do
    # List all active voice sessions from the Registry
    sessions =
      Ema.Voice.Registry
      |> Registry.select([{{:"$1", :"$2", :"$3"}, [], [{{:"$1", :"$2"}}]}])
      |> Enum.filter(fn
        {{:session, _id}, _pid} -> true
        _ -> false
      end)
      |> Enum.map(fn {{:session, session_id}, _pid} ->
        case safe_get_state(session_id) do
          {:ok, state} ->
            %{
              id: session_id,
              state: state[:state] || "unknown",
              history_length: length(state[:history] || [])
            }

          :error ->
            %{id: session_id, state: "unknown", history_length: 0}
        end
      end)

    json(conn, %{sessions: sessions})
  end

  def create_session(conn, params) do
    session_id = params["session_id"] || generate_session_id()

    # Voice sessions need a channel_pid for push notifications.
    # For REST-initiated sessions we use self() as a placeholder;
    # the real channel_pid is attached when the WebSocket connects.
    opts = [session_id: session_id, channel_pid: self()]

    case DynamicSupervisor.start_child(
           Ema.Voice.SessionSupervisor,
           {VoiceCore, opts}
         ) do
      {:ok, _pid} ->
        conn
        |> put_status(:created)
        |> json(%{session: %{id: session_id, state: "idle"}})

      {:error, {:already_started, _pid}} ->
        conn
        |> put_status(:conflict)
        |> json(%{error: "session_exists", session_id: session_id})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "create_failed", message: inspect(reason)})
    end
  end

  @doc """
  POST /api/voice/process — Stateless text processing endpoint.
  Accepts {"text": "..."} and routes through CommandParser + Claude,
  returning {"reply": "..."} for the frontend voice router fallback.
  """
  def process(conn, %{"text" => text}) when is_binary(text) and text != "" do
    alias Ema.Voice.CommandParser

    reply =
      case CommandParser.parse(text) do
        {:command, :open_app, app} ->
          Phoenix.PubSub.broadcast(Ema.PubSub, "workspace:commands", {:open_app, app})
          "Opening #{app}."

        {:command, :create_task, content} ->
          case Ema.Tasks.create_task(%{title: content, status: "todo"}) do
            {:ok, task} -> "Task created: #{task.title}"
            {:error, _} -> "I couldn't create that task."
          end

        {:command, :brain_dump, content} ->
          case Ema.BrainDump.create_item(%{content: content, source: "voice"}) do
            {:ok, _item} -> "Captured to brain dump."
            {:error, _} -> "Failed to capture that."
          end

        {:command, :ask_claude, question} ->
          case Ema.Claude.Bridge.run(question, timeout: 60_000) do
            {:ok, response} -> response
            {:error, _} -> "I couldn't reach Claude right now."
          end

        {:command, :show, target} ->
          Phoenix.PubSub.broadcast(Ema.PubSub, "workspace:commands", {:navigate, target})
          "Showing #{target}."

        {:command, _other, raw} ->
          "I'm not sure how to handle: #{raw}"

        :conversation ->
          prompt = """
          You are Jarvis, an AI assistant integrated into EMA.
          Be concise, helpful, and slightly formal. Keep responses under 3 sentences.

          User: #{text}
          """

          case Ema.Claude.Bridge.run(prompt, timeout: 60_000) do
            {:ok, response} -> response
            {:error, _} -> "I'm having trouble processing that right now."
          end
      end

    json(conn, %{reply: reply})
  end

  def process(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "missing or empty text parameter"})
  end

  def end_session(conn, %{"id" => session_id}) do
    try do
      VoiceCore.stop(session_id)
      json(conn, %{ok: true, session_id: session_id})
    catch
      :exit, {:noproc, _} -> {:error, :not_found}
      :exit, {:normal, _} -> json(conn, %{ok: true, session_id: session_id})
    end
  end

  # --- Helpers ---

  defp safe_get_state(session_id) do
    {:ok, VoiceCore.get_state(session_id)}
  catch
    :exit, _ -> :error
  end

  defp generate_session_id do
    ts = System.system_time(:second)
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "voice_#{ts}_#{rand}"
  end
end
