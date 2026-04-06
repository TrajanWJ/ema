defmodule Ema.Voice.TtsEngine do
  @moduledoc """
  Text-to-speech engine using OpenAI TTS API.
  Supports streaming audio back to the frontend.
  Configurable voice — defaults to a deep, authoritative Jarvis-like tone.
  """
  use GenServer
  require Logger

  @tts_url "https://api.openai.com/v1/audio/speech"

  @default_config %{
    model: "tts-1-hd",
    voice: "onyx",
    speed: 1.0,
    response_format: "opus"
  }

  # ── Client API ──

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Synthesize text to speech audio. Returns {:ok, binary_audio} or {:error, reason}.
  """
  def synthesize(text, opts \\ []) do
    GenServer.call(__MODULE__, {:synthesize, text, opts}, 30_000)
  end

  @doc """
  Stream TTS audio in chunks to a callback function.
  callback receives {:chunk, binary} for each chunk and :done when complete.
  """
  def stream(text, callback, opts \\ []) when is_function(callback, 1) do
    GenServer.cast(__MODULE__, {:stream, text, callback, opts})
  end

  @doc """
  Get or update the current voice configuration.
  """
  def get_config do
    GenServer.call(__MODULE__, :get_config)
  end

  def set_config(config) when is_map(config) do
    GenServer.call(__MODULE__, {:set_config, config})
  end

  # ── Server Callbacks ──

  @impl true
  def init(_opts) do
    {:ok, %{config: @default_config}}
  end

  @impl true
  def handle_call({:synthesize, text, opts}, _from, state) do
    config = merge_config(state.config, opts)
    result = do_synthesize(text, config)
    {:reply, result, state}
  end

  def handle_call(:get_config, _from, state) do
    {:reply, state.config, state}
  end

  def handle_call({:set_config, new_config}, _from, state) do
    config = Map.merge(state.config, atomize_keys(new_config))
    {:reply, :ok, %{state | config: config}}
  end

  @impl true
  def handle_cast({:stream, text, callback, opts}, state) do
    config = merge_config(state.config, opts)

    Task.start(fn ->
      case do_synthesize(text, config) do
        {:ok, audio} ->
          # Chunk the audio into ~4KB pieces for streaming
          chunk_and_send(audio, callback, 4096)
          callback.(:done)

        {:error, reason} ->
          callback.({:error, reason})
      end
    end)

    {:noreply, state}
  end

  # ── Internals ──

  defp do_synthesize(text, config) do
    api_key = Application.get_env(:ema, :openai_api_key)

    if is_nil(api_key) do
      {:error, :no_api_key}
    else
      body =
        Jason.encode!(%{
          model: config.model,
          input: text,
          voice: config.voice,
          speed: config.speed,
          response_format: config.response_format
        })

      headers = [
        {~c"Authorization", ~c"Bearer #{api_key}"},
        {~c"Content-Type", ~c"application/json"}
      ]

      case :httpc.request(
             :post,
             {~c"#{@tts_url}", headers, ~c"application/json", String.to_charlist(body)},
             [timeout: 30_000],
             body_format: :binary
           ) do
        {:ok, {{_, 200, _}, _headers, audio_data}} ->
          {:ok, :erlang.list_to_binary(audio_data)}

        {:ok, {{_, status, _}, _headers, resp_body}} ->
          Logger.error("TTS API error #{status}: #{resp_body}")
          {:error, {:api_error, status}}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp chunk_and_send(<<>>, _callback, _size), do: :ok

  defp chunk_and_send(data, callback, size) when byte_size(data) <= size do
    callback.({:chunk, data})
  end

  defp chunk_and_send(data, callback, size) do
    <<chunk::binary-size(size), rest::binary>> = data
    callback.({:chunk, chunk})
    chunk_and_send(rest, callback, size)
  end

  defp merge_config(base, opts) do
    overrides =
      opts
      |> Keyword.take([:voice, :speed, :model, :response_format])
      |> Map.new()

    Map.merge(base, overrides)
  end

  defp atomize_keys(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) -> {String.to_existing_atom(k), v}
      {k, v} when is_atom(k) -> {k, v}
    end)
  end
end
