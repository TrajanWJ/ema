defmodule Ema.Voice.VoiceCore do
  @moduledoc """
  GenServer managing a single voice session. Accepts audio chunks,
  streams to Whisper API for transcription, routes transcribed text
  to the appropriate EMA subsystem.

  Each session is started dynamically under Ema.Voice.SessionSupervisor.
  """
  use GenServer, restart: :temporary
  require Logger

  alias Ema.Voice.{CommandParser, Conversation, TtsEngine}

  defstruct [
    :session_id,
    :channel_pid,
    :conversation,
    audio_buffer: <<>>,
    state: :idle,
    last_activity: nil
  ]

  @idle_timeout_ms :timer.minutes(10)
  @whisper_url "https://api.openai.com/v1/audio/transcriptions"

  # ── Client API ──

  def start_link(opts) do
    session_id = Keyword.fetch!(opts, :session_id)
    channel_pid = Keyword.fetch!(opts, :channel_pid)

    GenServer.start_link(__MODULE__, opts,
      name: via(session_id)
    )
  end

  def push_audio(session_id, chunk) when is_binary(chunk) do
    GenServer.cast(via(session_id), {:audio_chunk, chunk})
  end

  def finish_utterance(session_id) do
    GenServer.call(via(session_id), :finish_utterance, 30_000)
  end

  def send_text(session_id, text) do
    GenServer.call(via(session_id), {:text_input, text}, 60_000)
  end

  def get_state(session_id) do
    GenServer.call(via(session_id), :get_state)
  end

  def stop(session_id) do
    GenServer.stop(via(session_id), :normal)
  end

  defp via(session_id) do
    {:via, Registry, {Ema.Voice.Registry, {:session, session_id}}}
  end

  # ── Server Callbacks ──

  @impl true
  def init(opts) do
    session_id = Keyword.fetch!(opts, :session_id)
    channel_pid = Keyword.fetch!(opts, :channel_pid)
    Process.monitor(channel_pid)

    state = %__MODULE__{
      session_id: session_id,
      channel_pid: channel_pid,
      conversation: Conversation.new(session_id),
      last_activity: System.monotonic_time(:millisecond)
    }

    schedule_idle_check()
    Logger.info("Voice session started: #{session_id}")
    {:ok, state}
  end

  @impl true
  def handle_cast({:audio_chunk, chunk}, state) do
    {:noreply, %{state | audio_buffer: state.audio_buffer <> chunk, state: :listening, last_activity: now()}}
  end

  @impl true
  def handle_call(:finish_utterance, _from, %{audio_buffer: <<>>} = state) do
    {:reply, {:error, :no_audio}, %{state | state: :idle}}
  end

  def handle_call(:finish_utterance, _from, state) do
    state = %{state | state: :processing}
    notify_channel(state, "voice:state", %{state: "processing"})

    case transcribe(state.audio_buffer) do
      {:ok, text} ->
        state = %{state | audio_buffer: <<>>, last_activity: now()}
        {response, new_state} = process_transcription(text, state)
        {:reply, {:ok, %{transcription: text, response: response}}, new_state}

      {:error, reason} ->
        Logger.error("Transcription failed: #{inspect(reason)}")
        notify_channel(state, "voice:error", %{error: "transcription_failed"})
        {:reply, {:error, reason}, %{state | audio_buffer: <<>>, state: :idle}}
    end
  end

  def handle_call({:text_input, text}, _from, state) do
    state = %{state | state: :processing, last_activity: now()}
    notify_channel(state, "voice:state", %{state: "processing"})

    {response, new_state} = process_transcription(text, state)
    {:reply, {:ok, %{response: response}}, new_state}
  end

  def handle_call(:get_state, _from, state) do
    {:reply, %{state: state.state, history: Conversation.history(state.conversation)}, state}
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, pid, _reason}, %{channel_pid: pid} = state) do
    Logger.info("Voice session #{state.session_id} channel disconnected, shutting down")
    {:stop, :normal, state}
  end

  def handle_info(:idle_check, state) do
    elapsed = now() - state.last_activity

    if elapsed > @idle_timeout_ms do
      Logger.info("Voice session #{state.session_id} idle timeout")
      notify_channel(state, "voice:session_ended", %{reason: "idle_timeout"})
      {:stop, :normal, state}
    else
      schedule_idle_check()
      {:noreply, state}
    end
  end

  # ── Internals ──

  defp process_transcription(text, state) do
    conversation = Conversation.add_message(state.conversation, :user, text)
    notify_channel(state, "voice:transcription", %{text: text, role: "user"})

    case CommandParser.parse(text) do
      {:command, command, args} ->
        response = execute_command(command, args, state)
        conversation = Conversation.add_message(conversation, :assistant, response)
        notify_channel(state, "voice:response", %{text: response, role: "assistant", type: "command"})
        maybe_speak(response, state)
        {response, %{state | conversation: conversation, state: :idle}}

      :conversation ->
        response = handle_conversation(text, conversation, state)
        conversation = Conversation.add_message(conversation, :assistant, response)
        notify_channel(state, "voice:response", %{text: response, role: "assistant", type: "conversation"})
        maybe_speak(response, state)
        {response, %{state | conversation: conversation, state: :idle}}
    end
  end

  defp execute_command(:open_app, app_name, _state) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "workspace:commands", {:open_app, app_name})
    "Opening #{app_name}."
  end

  defp execute_command(:create_task, task_text, _state) do
    case Ema.Tasks.create_task(%{title: task_text, status: "todo"}) do
      {:ok, task} -> "Task created: #{task.title}"
      {:error, _} -> "I couldn't create that task. Please try again."
    end
  end

  defp execute_command(:brain_dump, content, _state) do
    case Ema.BrainDump.create_item(%{content: content, source: "voice"}) do
      {:ok, _item} -> "Captured to brain dump."
      {:error, _} -> "Failed to capture. Please try again."
    end
  end

  defp execute_command(:ask_claude, question, _state) do
    case Ema.Claude.Runner.run(question, timeout: 60_000) do
      {:ok, response} -> response
      {:error, _} -> "I couldn't reach Claude right now."
    end
  end

  defp execute_command(:show, target, _state) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "workspace:commands", {:navigate, target})
    "Showing #{target}."
  end

  defp execute_command(:unknown, raw, _state) do
    "I'm not sure how to handle: #{raw}"
  end

  defp handle_conversation(text, conversation, _state) do
    context = Conversation.build_context(conversation)

    prompt = """
    You are Jarvis, an AI assistant integrated into EMA (a personal operating system).
    Be concise, helpful, and slightly formal — like a capable butler.
    Keep responses under 3 sentences unless the user asks for detail.

    Conversation context:
    #{context}

    User: #{text}
    """

    case Ema.Claude.Runner.run(prompt, timeout: 60_000) do
      {:ok, response} -> response
      {:error, _} -> "I'm having trouble processing that. Could you rephrase?"
    end
  end

  defp transcribe(audio_data) do
    api_key = Application.get_env(:ema, :openai_api_key)

    if is_nil(api_key) do
      {:error, :no_api_key}
    else
      # Build multipart form data for Whisper API
      boundary = "----EmaVoice#{System.unique_integer([:positive])}"

      body =
        multipart_body(boundary, [
          {"file", "audio.webm", "audio/webm", audio_data},
          {"model", "whisper-1"},
          {"language", "en"},
          {"response_format", "json"}
        ])

      headers = [
        {"Authorization", "Bearer #{api_key}"},
        {"Content-Type", "multipart/form-data; boundary=#{boundary}"}
      ]

      case :httpc.request(
             :post,
             {~c"#{@whisper_url}", Enum.map(headers, fn {k, v} -> {~c"#{k}", ~c"#{v}"} end), ~c"multipart/form-data; boundary=#{boundary}", body},
             [timeout: 30_000],
             []
           ) do
        {:ok, {{_, 200, _}, _headers, resp_body}} ->
          case Jason.decode(to_string(resp_body)) do
            {:ok, %{"text" => text}} -> {:ok, String.trim(text)}
            _ -> {:error, :parse_failed}
          end

        {:ok, {{_, status, _}, _headers, resp_body}} ->
          Logger.error("Whisper API error #{status}: #{resp_body}")
          {:error, {:api_error, status}}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp multipart_body(boundary, parts) do
    parts
    |> Enum.map(fn
      {name, filename, content_type, data} ->
        "--#{boundary}\r\nContent-Disposition: form-data; name=\"#{name}\"; filename=\"#{filename}\"\r\nContent-Type: #{content_type}\r\n\r\n#{data}\r\n"

      {name, value} ->
        "--#{boundary}\r\nContent-Disposition: form-data; name=\"#{name}\"\r\n\r\n#{value}\r\n"
    end)
    |> Enum.join()
    |> Kernel.<>("--#{boundary}--\r\n")
    |> :erlang.binary_to_list()
  end

  defp maybe_speak(text, state) do
    Task.start(fn ->
      case TtsEngine.synthesize(text) do
        {:ok, audio_data} ->
          send(state.channel_pid, {:tts_audio, audio_data})

        {:error, reason} ->
          Logger.warning("TTS failed: #{inspect(reason)}")
      end
    end)
  end

  defp notify_channel(state, event, payload) do
    send(state.channel_pid, {:push_event, event, payload})
  end

  defp schedule_idle_check do
    Process.send_after(self(), :idle_check, :timer.minutes(2))
  end

  defp now, do: System.monotonic_time(:millisecond)
end
