defmodule EmaWeb.VoiceController do
  use EmaWeb, :controller

  alias Ema.Voice.VoiceCore

  action_fallback EmaWeb.FallbackController

  def sessions(conn, _params) do
    # List all active voice sessions from the Registry
    sessions =
      Ema.Voice.Registry
      |> Registry.select([{{:"$1", :"$2", :"$3"}, [], [{{:"$1", :"$2"}}]}])
      |> Enum.filter(fn {{:session, _id}, _pid} -> true; _ -> false end)
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
