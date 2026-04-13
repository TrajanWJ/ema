defmodule Ema.Claude.Adapters.OpenRouter do
  @moduledoc """
  Adapter for the OpenRouter HTTP API.

  Uses `Req` for HTTP with Server-Sent Events (SSE) streaming.
  Endpoint: `https://openrouter.ai/api/v1/chat/completions`

  Requires `OPENROUTER_API_KEY` environment variable or application config.
  Supports dynamic model listing from the OpenRouter API.

  SSE events are parsed from `data:` lines into normalized event maps.
  """

  @behaviour Ema.Claude.Adapter

  require Logger

  @api_base "https://openrouter.ai/api/v1"
  @default_model "anthropic/claude-3.5-sonnet"

  # For streaming sessions, we use a lightweight GenServer process per session.
  defmodule Session do
    @moduledoc false
    use GenServer

    def start_link(opts) do
      GenServer.start_link(__MODULE__, opts)
    end

    def init(opts) do
      {:ok, %{opts: opts, buffer: "", messages: [], caller: nil}}
    end

    def handle_call({:send, message}, from, state) do
      messages = state.messages ++ [%{"role" => "user", "content" => message}]
      {:reply, :ok, %{state | messages: messages, caller: from}}
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
    GenServer.call(pid, {:send, message})
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
    %{
      streaming: true,
      multi_turn: true,
      tool_use: true,
      models: list_models_cached(),
      task_types: [
        :code_generation,
        :code_review,
        :summarization,
        :research,
        :creative,
        :general,
        :bulk
      ],
      dynamic_models: true
    }
  end

  @impl true
  def health_check do
    api_key = get_api_key()

    if api_key == nil or api_key == "" do
      {:error, :missing_api_key}
    else
      case Req.get("#{@api_base}/models",
             headers: [{"Authorization", "Bearer #{api_key}"}],
             receive_timeout: 5_000
           ) do
        {:ok, %{status: 200}} -> :ok
        {:ok, %{status: code}} -> {:error, {:http_error, code}}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  @impl true
  def parse_event(raw) when is_binary(raw) do
    line = String.trim(raw)

    cond do
      line == "" or line == "data: [DONE]" ->
        :skip

      String.starts_with?(line, "data: ") ->
        json_str = String.slice(line, 6..-1//1)

        case Jason.decode(json_str) do
          {:ok, %{"choices" => [%{"delta" => %{"content" => content}} | _]} = event}
          when is_binary(content) ->
            {:ok,
             %{
               type: :text_delta,
               content: content,
               model: event["model"],
               raw: event
             }}

          {:ok, %{"choices" => [%{"finish_reason" => reason} | _]} = event}
          when reason != nil ->
            usage = event["usage"] || %{}

            {:ok,
             %{
               type: :message_stop,
               finish_reason: reason,
               usage: %{
                 tokens_in: usage["prompt_tokens"] || 0,
                 tokens_out: usage["completion_tokens"] || 0
               },
               raw: event
             }}

          {:ok, %{"error" => error}} ->
            {:error, %{message: error["message"] || inspect(error), raw: error}}

          {:ok, _event} ->
            :skip

          {:error, _} ->
            Logger.debug("OpenRouter: failed to parse SSE data: #{inspect(json_str)}")
            :skip
        end

      String.starts_with?(line, ":") ->
        # SSE comment / keepalive
        :skip

      true ->
        :skip
    end
  end

  @doc """
  Execute a streaming completion request. Calls `callback` for each parsed event.
  Returns `{:ok, full_response}` when complete.
  """
  def stream_completion(messages, model, opts, callback) do
    api_key = get_api_key()

    if api_key == nil or api_key == "" do
      {:error, :missing_api_key}
    else
      body = %{
        "model" => model || @default_model,
        "messages" => messages,
        "stream" => true,
        "max_tokens" => Keyword.get(opts, :max_tokens, 4096)
      }

      Req.post("#{@api_base}/chat/completions",
        headers: [
          {"Authorization", "Bearer #{api_key}"},
          {"HTTP-Referer", Keyword.get(opts, :referer, "https://github.com/ema")},
          {"X-Title", Keyword.get(opts, :app_name, "EMA")}
        ],
        json: body,
        into: fn {:data, chunk}, acc ->
          chunk
          |> String.split("\n")
          |> Enum.each(fn line ->
            case parse_event(line) do
              {:ok, event} -> callback.(event)
              :skip -> :ok
              {:error, err} -> Logger.warning("OpenRouter stream error: #{inspect(err)}")
            end
          end)

          {:cont, acc}
        end,
        receive_timeout: Keyword.get(opts, :timeout, 120_000)
      )
    end
  end

  @doc """
  List available models from the OpenRouter API.
  """
  def list_models do
    api_key = get_api_key()

    case Req.get("#{@api_base}/models",
           headers: [{"Authorization", "Bearer #{api_key}"}],
           receive_timeout: 10_000
         ) do
      {:ok, %{status: 200, body: %{"data" => models}}} ->
        {:ok, Enum.map(models, & &1["id"])}

      {:ok, %{status: code, body: body}} ->
        {:error, {:http_error, code, body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Private helpers

  defp get_api_key do
    System.get_env("OPENROUTER_API_KEY") ||
      Application.get_env(:ema, :openrouter_api_key)
  end

  defp list_models_cached do
    # Return a static default list; runtime lookup via list_models/0
    [
      "anthropic/claude-3.5-sonnet",
      "anthropic/claude-3-haiku",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "meta-llama/llama-3.1-70b-instruct",
      "google/gemini-pro-1.5"
    ]
  end
end
