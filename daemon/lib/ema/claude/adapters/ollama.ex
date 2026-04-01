defmodule Ema.Claude.Adapters.Ollama do
  @moduledoc """
  Adapter for local Ollama instances.

  Communicates with the Ollama HTTP API at `http://localhost:11434` (configurable).
  Uses `/api/chat` with `stream: true` for streaming responses (NDJSON format).
  Health check via `/api/tags`. Model listing via `/api/tags`.

  Ollama runs models locally — no API key required.
  """

  @behaviour Ema.Claude.Adapter

  require Logger

  @default_base_url "http://localhost:11434"
  @default_model "llama3.2"

  defmodule Session do
    @moduledoc false
    use GenServer

    def start_link(opts), do: GenServer.start_link(__MODULE__, opts)

    def init(opts) do
      {:ok, %{opts: opts, messages: Keyword.get(opts, :messages, [])}}
    end

    def handle_call({:add_message, role, content}, _from, state) do
      messages = state.messages ++ [%{"role" => role, "content" => content}]
      {:reply, :ok, %{state | messages: messages}}
    end

    def handle_call(:get_messages, _from, state) do
      {:reply, state.messages, state}
    end
  end

  @impl true
  def start_session(prompt, _session_id, model, opts \\ []) do
    messages = [%{"role" => "user", "content" => prompt}]
    session_opts = Keyword.merge(opts, model: model || @default_model, messages: messages)

    case Session.start_link(session_opts) do
      {:ok, pid} -> {:ok, pid}
      error -> error
    end
  end

  @impl true
  def send_message(pid, message) when is_pid(pid) do
    GenServer.call(pid, {:add_message, "user", message})
  end

  @impl true
  def stop_session(pid) when is_pid(pid) do
    if Process.alive?(pid) do
      GenServer.stop(pid, :normal)
    end

    :ok
  end

  @impl true
  def capabilities do
    base_url = get_base_url()

    models =
      case list_models() do
        {:ok, m} -> m
        _ -> []
      end

    %{
      streaming: true,
      multi_turn: true,
      tool_use: false,
      models: models,
      task_types: [:code_generation, :summarization, :general, :bulk],
      base_url: base_url,
      local: true,
      no_api_key: true
    }
  end

  @impl true
  def health_check do
    base_url = get_base_url()

    case Req.get("#{base_url}/api/tags", receive_timeout: 5_000) do
      {:ok, %{status: 200}} -> :ok
      {:ok, %{status: code}} -> {:error, {:http_error, code}}
      {:error, %{reason: :econnrefused}} -> {:error, :ollama_not_running}
      {:error, reason} -> {:error, reason}
    end
  end

  @impl true
  def parse_event(raw) when is_binary(raw) do
    line = String.trim(raw)

    if line == "" do
      :skip
    else
      case Jason.decode(line) do
        {:ok, %{"message" => %{"content" => content}, "done" => false}} ->
          {:ok, %{type: :text_delta, content: content, raw: line}}

        {:ok, %{"done" => true} = event} ->
          {:ok,
           %{
             type: :message_stop,
             usage: %{
               tokens_in: event["prompt_eval_count"] || 0,
               tokens_out: event["eval_count"] || 0
             },
             model: event["model"],
             raw: event
           }}

        {:ok, %{"error" => error}} ->
          {:error, %{message: error, raw: line}}

        {:ok, _} ->
          :skip

        {:error, _} ->
          Logger.debug("Ollama: failed to parse NDJSON line: #{inspect(line)}")
          :skip
      end
    end
  end

  @doc """
  Execute a streaming chat request. Calls `callback` for each parsed event.
  """
  def stream_chat(messages, model, opts, callback) do
    base_url = Keyword.get(opts, :base_url, get_base_url())

    body = %{
      "model" => model || @default_model,
      "messages" => messages,
      "stream" => true,
      "options" => %{
        "num_predict" => Keyword.get(opts, :max_tokens, -1),
        "temperature" => Keyword.get(opts, :temperature, 0.7)
      }
    }

    Req.post("#{base_url}/api/chat",
      json: body,
      into: fn {:data, chunk}, acc ->
        chunk
        |> String.split("\n")
        |> Enum.each(fn line ->
          case parse_event(line) do
            {:ok, event} -> callback.(event)
            :skip -> :ok
            {:error, err} -> Logger.warning("Ollama stream error: #{inspect(err)}")
          end
        end)

        {:cont, acc}
      end,
      receive_timeout: Keyword.get(opts, :timeout, 120_000)
    )
  end

  @doc """
  List available models from the local Ollama instance.
  """
  def list_models do
    base_url = get_base_url()

    case Req.get("#{base_url}/api/tags", receive_timeout: 5_000) do
      {:ok, %{status: 200, body: %{"models" => models}}} ->
        names = Enum.map(models, & &1["name"])
        {:ok, names}

      {:ok, %{status: code}} ->
        {:error, {:http_error, code}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Pull a model from the Ollama registry.
  """
  def pull_model(model_name) do
    base_url = get_base_url()

    case Req.post("#{base_url}/api/pull", json: %{"name" => model_name}, receive_timeout: 300_000) do
      {:ok, %{status: 200}} -> :ok
      {:ok, %{status: code, body: body}} -> {:error, {:http_error, code, body}}
      {:error, reason} -> {:error, reason}
    end
  end

  # Private helpers

  defp get_base_url do
    System.get_env("OLLAMA_BASE_URL") ||
      Application.get_env(:ema, :ollama_base_url, @default_base_url)
  end
end
