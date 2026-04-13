defmodule Ema.Discord.Bridge do
  @moduledoc """
  Routes Discord messages through EMA's VoiceCore pipeline.
  Maintains one VoiceCore session per Discord channel so Jarvis
  remembers conversation context across messages in the same channel.

  Sessions use :discord mode — text-only responses (no TTS audio),
  30-minute idle timeout.
  """
  use GenServer
  require Logger

  alias Ema.Voice.VoiceCore

  # ── Client API ──

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Process an incoming Discord message. Returns {:ok, response} or {:error, reason}.
  Async-safe: multiple channels can message simultaneously.
  """
  def receive_message(channel_id, user_id, text) do
    GenServer.call(__MODULE__, {:message, channel_id, user_id, text}, 60_000)
  end

  @doc """
  Explicitly clear a channel's session (e.g., on Discord channel reset).
  """
  def clear_session(channel_id) do
    GenServer.cast(__MODULE__, {:clear_session, channel_id})
  end

  @doc """
  Returns the current session_id for a channel, or nil if none.
  """
  def session_id_for(channel_id) do
    GenServer.call(__MODULE__, {:session_id, channel_id})
  end

  # ── Server Callbacks ──

  @impl true
  def init(_opts) do
    Logger.info("Ema.Discord.Bridge started")
    {:ok, %{sessions: %{}}}
  end

  @impl true
  def handle_call({:message, channel_id, _user_id, text}, _from, state) do
    {session_id, state} = ensure_session(channel_id, state)

    case VoiceCore.send_text(session_id, text) do
      {:ok, %{response: response}} ->
        {:reply, {:ok, extract_result(response)}, state}

      {:error, :not_found} ->
        # Session died — create a new one and retry once
        Logger.warning(
          "Discord session #{session_id} not found, recreating for channel #{channel_id}"
        )

        state = drop_session(channel_id, state)
        {session_id, state} = ensure_session(channel_id, state)

        case VoiceCore.send_text(session_id, text) do
          {:ok, %{response: response}} -> {:reply, {:ok, extract_result(response)}, state}
          {:error, reason} -> {:reply, {:error, reason}, state}
        end

      {:error, reason} ->
        Logger.error("Discord Bridge VoiceCore error: #{inspect(reason)}")
        {:reply, {:error, reason}, state}
    end
  end

  def handle_call({:session_id, channel_id}, _from, state) do
    {:reply, Map.get(state.sessions, channel_id), state}
  end

  @impl true
  def handle_cast({:clear_session, channel_id}, state) do
    case Map.get(state.sessions, channel_id) do
      nil ->
        {:noreply, state}

      session_id ->
        try do
          VoiceCore.stop(session_id)
        catch
          :exit, _ -> :ok
        end

        {:noreply, drop_session(channel_id, state)}
    end
  end

  # ── Internals ──

  defp ensure_session(channel_id, state) do
    case Map.get(state.sessions, channel_id) do
      nil ->
        create_session(channel_id, state)

      session_id ->
        # Verify session is still alive
        case Registry.lookup(Ema.Voice.Registry, {:session, session_id}) do
          [{_pid, _}] ->
            {session_id, state}

          [] ->
            # Session died silently — recreate
            Logger.info(
              "Discord session #{session_id} gone, recreating for channel #{channel_id}"
            )

            state = drop_session(channel_id, state)
            create_session(channel_id, state)
        end
    end
  end

  defp create_session(channel_id, state) do
    session_id = "discord_#{channel_id}_#{System.unique_integer([:positive])}"

    case DynamicSupervisor.start_child(
           Ema.Voice.SessionSupervisor,
           {VoiceCore, session_id: session_id, channel_pid: self(), mode: :discord}
         ) do
      {:ok, _pid} ->
        Logger.info("Discord session created: #{session_id} for channel #{channel_id}")
        {session_id, put_in(state.sessions[channel_id], session_id)}

      {:error, reason} ->
        Logger.error("Failed to start Discord VoiceCore session: #{inspect(reason)}")

        raise "Cannot start VoiceCore session for Discord channel #{channel_id}: #{inspect(reason)}"
    end
  end

  defp drop_session(channel_id, state) do
    %{state | sessions: Map.delete(state.sessions, channel_id)}
  end

  # Claude CLI returns a full JSON map with "result", "duration_ms", etc.
  # Extract just the text response for callers that expect a string.
  defp extract_result(%{"result" => result}) when is_binary(result), do: result
  defp extract_result(response) when is_binary(response), do: response
  defp extract_result(response) when is_map(response), do: inspect(response)
end
