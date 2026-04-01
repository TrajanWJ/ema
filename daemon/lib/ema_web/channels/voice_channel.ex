defmodule EmaWeb.VoiceChannel do
  @moduledoc """
  Phoenix Channel for bidirectional voice streaming.
  Handles audio chunks from the frontend, manages voice sessions,
  and streams TTS audio back.
  """
  use Phoenix.Channel
  require Logger

  alias Ema.Voice.{VoiceCore, TtsEngine, CommandParser}

  @impl true
  def join("voice:session", _payload, socket) do
    session_id = "voice_#{System.unique_integer([:positive])}"

    case DynamicSupervisor.start_child(
           Ema.Voice.SessionSupervisor,
           {VoiceCore, session_id: session_id, channel_pid: self()}
         ) do
      {:ok, _pid} ->
        socket =
          socket
          |> assign(:session_id, session_id)
          |> assign(:recording, false)

        send(self(), :send_initial_state)

        {:ok, %{session_id: session_id}, socket}

      {:error, reason} ->
        Logger.error("Failed to start voice session: #{inspect(reason)}")
        {:error, %{reason: "session_start_failed"}}
    end
  end

  @impl true
  def handle_in("audio:chunk", %{"data" => base64_data}, socket) do
    case Base.decode64(base64_data) do
      {:ok, audio_bytes} ->
        VoiceCore.push_audio(socket.assigns.session_id, audio_bytes)
        {:noreply, assign(socket, :recording, true)}

      :error ->
        {:reply, {:error, %{reason: "invalid_audio_data"}}, socket}
    end
  end

  def handle_in("audio:finish", _payload, socket) do
    session_id = socket.assigns.session_id
    socket = assign(socket, :recording, false)

    # Run transcription async to avoid blocking the channel
    channel_pid = self()

    Task.start(fn ->
      case VoiceCore.finish_utterance(session_id) do
        {:ok, result} ->
          send(channel_pid, {:utterance_complete, result})

        {:error, :no_audio} ->
          send(channel_pid, {:push_event, "voice:error", %{error: "no_audio_captured"}})

        {:error, reason} ->
          send(channel_pid, {:push_event, "voice:error", %{error: inspect(reason)}})
      end
    end)

    {:noreply, socket}
  end

  def handle_in("text:send", %{"text" => text}, socket) do
    session_id = socket.assigns.session_id
    channel_pid = self()

    Task.start(fn ->
      case VoiceCore.send_text(session_id, text) do
        {:ok, result} ->
          send(channel_pid, {:text_response, result})

        {:error, reason} ->
          send(channel_pid, {:push_event, "voice:error", %{error: inspect(reason)}})
      end
    end)

    {:noreply, socket}
  end

  def handle_in("tts:config", config, socket) do
    TtsEngine.set_config(config)
    {:reply, :ok, socket}
  end

  def handle_in("session:clear", _payload, socket) do
    # Stop old session, start fresh
    session_id = socket.assigns.session_id
    VoiceCore.stop(session_id)

    new_session_id = "voice_#{System.unique_integer([:positive])}"

    case DynamicSupervisor.start_child(
           Ema.Voice.SessionSupervisor,
           {VoiceCore, session_id: new_session_id, channel_pid: self()}
         ) do
      {:ok, _pid} ->
        socket = assign(socket, :session_id, new_session_id)
        push(socket, "voice:session_cleared", %{session_id: new_session_id})
        {:noreply, socket}

      {:error, _} ->
        {:reply, {:error, %{reason: "restart_failed"}}, socket}
    end
  end

  def handle_in("commands:list", _payload, socket) do
    commands = CommandParser.available_commands()
    {:reply, {:ok, %{commands: commands}}, socket}
  end

  @impl true
  def handle_info(:send_initial_state, socket) do
    tts_config = TtsEngine.get_config()
    commands = CommandParser.available_commands()

    push(socket, "voice:ready", %{
      session_id: socket.assigns.session_id,
      tts_config: tts_config,
      commands: commands
    })

    {:noreply, socket}
  end

  def handle_info({:utterance_complete, _result}, socket) do
    # Already pushed via VoiceCore notify_channel — nothing extra needed
    {:noreply, socket}
  end

  def handle_info({:text_response, _result}, socket) do
    {:noreply, socket}
  end

  def handle_info({:push_event, event, payload}, socket) do
    push(socket, event, payload)
    {:noreply, socket}
  end

  def handle_info({:tts_audio, audio_data}, socket) do
    # Stream TTS audio back in chunks to avoid large single messages
    chunk_size = 8192

    audio_data
    |> chunk_binary(chunk_size)
    |> Enum.with_index()
    |> Enum.each(fn {chunk, index} ->
      push(socket, "tts:chunk", %{
        data: Base.encode64(chunk),
        index: index,
        final: byte_size(audio_data) - (index + 1) * chunk_size <= 0
      })
    end)

    {:noreply, socket}
  end

  @impl true
  def terminate(_reason, socket) do
    if session_id = socket.assigns[:session_id] do
      try do
        VoiceCore.stop(session_id)
      catch
        :exit, _ -> :ok
      end
    end

    :ok
  end

  # ── Helpers ──

  defp chunk_binary(data, size) when byte_size(data) <= size, do: [data]

  defp chunk_binary(data, size) do
    <<chunk::binary-size(size), rest::binary>> = data
    [chunk | chunk_binary(rest, size)]
  end
end
