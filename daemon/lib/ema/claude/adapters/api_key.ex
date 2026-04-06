defmodule Ema.Claude.Adapters.ApiKey do
  @moduledoc """
  Adapter for the Anthropic Messages API using a direct API key.

  Calls `https://api.anthropic.com/v1/messages` with `x-api-key` auth.
  Uses `Req` for HTTP with Server-Sent Events (SSE) streaming.

  Reads the key from `Application.get_env(:ema, :anthropic_api_key)` or
  `ANTHROPIC_API_KEY` environment variable.

  This adapter bypasses OAuth entirely — useful when direct
  Anthropic API access is preferred or when OAuth gateways are unavailable.

  ## Usage

      # Via Bridge (automatic when ANTHROPIC_API_KEY is set)
      {:ok, result} = Ema.Claude.Bridge.run("ping", provider_id: "anthropic-api-key")

      # Direct
      {:ok, result} = Ema.Claude.Adapters.ApiKey.run("ping", "claude-sonnet-4-5", [])
      Ema.Claude.Adapters.ApiKey.stream("ping", "claude-sonnet-4-5", [], fn event ->
        IO.inspect(event)
      end)
  """

  @behaviour Ema.Claude.Adapter

  require Logger

  @api_base "https://api.anthropic.com/v1"
  @api_version "2023-06-01"
  @default_model "claude-sonnet-4-6"
  @default_max_tokens 8192

  # ── Behaviour callbacks ─────────────────────────────────────────────────────

  @impl true
  def start_session(prompt, _session_id, model, opts \\ []) do
    # For HTTP adapters, "start_session" = kick off the request in a Task
    # so the Bridge Port-message loop doesn't block. We spawn a process that
    # will send {:adapter_event, event} and {:adapter_done, result} to caller.
    caller = Keyword.get(opts, :caller, self())
    on_event = Keyword.get(opts, :on_event)
    resolved_model = model || @default_model

    pid =
      spawn_link(fn ->
        result = execute_streaming(prompt, resolved_model, opts, fn event ->
          send(caller, {:adapter_event, event})
          if on_event, do: on_event.(event)
        end)

        case result do
          {:ok, _resp} ->
            send(caller, {:adapter_done, %{session_id: nil, exit_code: 0}})

          {:error, reason} ->
            send(caller, {:adapter_error, reason})
        end
      end)

    {:ok, %{port: pid}}
  end

  @impl true
  def send_message(_pid, _message) do
    # Stateless HTTP — each message requires a new session
    {:error, :not_supported_use_new_session}
  end

  @impl true
  def stop_session(%{port: pid}) when is_pid(pid) do
    if Process.alive?(pid), do: Process.exit(pid, :normal)
    :ok
  end

  def stop_session(_), do: :ok

  @impl true
  def capabilities do
    %{
      streaming: true,
      multi_turn: false,
      tool_use: true,
      models: [
        "claude-opus-4-6",
        "claude-sonnet-4-6",
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-5",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022"
      ],
      task_types: [:code_generation, :code_review, :research, :creative, :general, :summarization],
      auth: :api_key,
      provider: :anthropic_direct
    }
  end

  @impl true
  def health_check do
    api_key = get_api_key()

    cond do
      api_key == nil or api_key == "" ->
        {:error, :missing_api_key}

      true ->
        # Minimal probe: count tokens on a trivial message
        case Req.post("#{@api_base}/messages",
               headers: build_headers(api_key),
               json: %{
                 "model" => @default_model,
                 "max_tokens" => 1,
                 "messages" => [%{"role" => "user", "content" => "hi"}]
               },
               receive_timeout: 10_000
             ) do
          {:ok, %{status: 200}} -> :ok
          {:ok, %{status: 401}} -> {:error, :invalid_api_key}
          {:ok, %{status: code}} -> {:error, {:http_error, code}}
          {:error, reason} -> {:error, reason}
        end
    end
  end

  @impl true
  def parse_event(raw) when is_binary(raw) do
    line = String.trim(raw)

    cond do
      line == "" ->
        :skip

      String.starts_with?(line, "event: ") ->
        # SSE event type line — we handle the paired data: line
        :skip

      String.starts_with?(line, "data: ") ->
        json_str = String.slice(line, 6..-1//1)

        case Jason.decode(json_str) do
          {:ok, %{"type" => "content_block_delta", "delta" => %{"type" => "text_delta", "text" => text}}} ->
            {:ok, %{type: :text_delta, content: text, raw: json_str}}

          {:ok, %{"type" => "message_stop"}} ->
            {:ok, %{type: :message_stop, content: "", usage: %{tokens_in: 0, tokens_out: 0}, raw: json_str}}

          {:ok, %{"type" => "message_delta", "usage" => usage}} ->
            {:ok,
             %{
               type: :message_stop,
               content: "",
               usage: %{
                 tokens_in: get_in(usage, ["input_tokens"]) || 0,
                 tokens_out: get_in(usage, ["output_tokens"]) || 0
               },
               raw: json_str
             }}

          {:ok, %{"type" => "message_start", "message" => %{"usage" => usage}}} ->
            {:ok,
             %{
               type: :message_start,
               usage: %{
                 tokens_in: get_in(usage, ["input_tokens"]) || 0,
                 tokens_out: 0
               },
               raw: json_str
             }}

          {:ok, %{"type" => "error", "error" => err}} ->
            {:error, %{message: err["message"] || inspect(err), raw: err}}

          {:ok, %{"type" => type}} when type in ["content_block_start", "content_block_stop", "ping"] ->
            :skip

          {:ok, _event} ->
            :skip

          {:error, _} ->
            Logger.debug("[ApiKey] Failed to parse SSE data: #{inspect(json_str)}")
            :skip
        end

      String.starts_with?(line, ":") ->
        # SSE keepalive comment
        :skip

      true ->
        :skip
    end
  end

  # ── Public convenience API ──────────────────────────────────────────────────

  @doc """
  One-shot blocking call. Returns `{:ok, result_map}` or `{:error, reason}`.

  ## Parameters
    - `prompt` — the user message
    - `model`  — model ID (default: #{@default_model})
    - `opts`   — keyword options: `:max_tokens`, `:system`, `:timeout`
  """
  @spec run(String.t(), String.t(), keyword()) :: {:ok, map()} | {:error, term()}
  def run(prompt, model \\ @default_model, opts \\ []) do
    api_key = get_api_key()

    if api_key == nil or api_key == "" do
      {:error, :missing_api_key}
    else
      body = build_body(prompt, model, opts)

      case Req.post("#{@api_base}/messages",
             headers: build_headers(api_key),
             json: body,
             receive_timeout: Keyword.get(opts, :timeout, 300_000)
           ) do
        {:ok, %{status: 200, body: resp}} ->
          {:ok, parse_response(resp)}

        {:ok, %{status: 401}} ->
          {:error, :invalid_api_key}

        {:ok, %{status: 429}} ->
          {:error, :rate_limited}

        {:ok, %{status: code, body: body}} ->
          {:error, {:http_error, code, body}}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  @doc """
  Streaming call with per-event callback. Returns `{:ok, %{text: full_text}}` when complete.

  ## Parameters
    - `prompt`   — the user message
    - `model`    — model ID (default: #{@default_model})
    - `opts`     — keyword options: `:max_tokens`, `:system`, `:timeout`
    - `callback` — `fn event_map -> :ok end` called for each parsed event
  """
  @spec stream(String.t(), String.t(), keyword(), function()) ::
          {:ok, map()} | {:error, term()}
  def stream(prompt, model \\ @default_model, opts \\ [], callback) do
    execute_streaming(prompt, model, opts, callback)
  end

  # ── Private ─────────────────────────────────────────────────────────────────

  defp execute_streaming(prompt, model, opts, callback) do
    api_key = get_api_key()

    if api_key == nil or api_key == "" do
      {:error, :missing_api_key}
    else
      body = build_body(prompt, model, opts) |> Map.put("stream", true)
      text_acc = :erlang.make_ref() |> :erlang.ref_to_list() |> to_string()
      # Use process dictionary to accumulate text across chunks
      Process.put(:api_key_text_acc, "")

      result =
        Req.post("#{@api_base}/messages",
          headers: build_headers(api_key),
          json: body,
          into: fn {:data, chunk}, acc ->
            chunk
            |> String.split("\n")
            |> Enum.each(fn line ->
              case parse_event(line) do
                {:ok, %{type: :text_delta, content: text} = event} ->
                  Process.put(:api_key_text_acc, Process.get(:api_key_text_acc, "") <> text)
                  callback.(event)

                {:ok, event} ->
                  callback.(event)

                :skip ->
                  :ok

                {:error, err} ->
                  Logger.warning("[ApiKey] Stream parse error: #{inspect(err)}")
              end
            end)

            {:cont, acc}
          end,
          receive_timeout: Keyword.get(opts, :timeout, 300_000)
        )

      full_text = Process.get(:api_key_text_acc, "")
      Process.delete(:api_key_text_acc)
      _ = text_acc

      case result do
        {:ok, _resp} -> {:ok, %{text: full_text}}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp build_headers(api_key) do
    [
      {"x-api-key", api_key},
      {"anthropic-version", @api_version},
      {"content-type", "application/json"}
    ]
  end

  defp build_body(prompt, model, opts) do
    body = %{
      "model" => model || @default_model,
      "max_tokens" => Keyword.get(opts, :max_tokens, @default_max_tokens),
      "messages" => [%{"role" => "user", "content" => prompt}]
    }

    case Keyword.get(opts, :system) do
      nil -> body
      sys -> Map.put(body, "system", sys)
    end
  end

  defp parse_response(%{"content" => [%{"text" => text} | _]} = resp) do
    usage = resp["usage"] || %{}

    %{
      text: text,
      model: resp["model"],
      stop_reason: resp["stop_reason"],
      usage: %{
        tokens_in: usage["input_tokens"] || 0,
        tokens_out: usage["output_tokens"] || 0
      }
    }
  end

  defp parse_response(resp), do: %{text: "", raw: resp}

  defp get_api_key do
    Application.get_env(:ema, :anthropic_api_key) ||
      System.get_env("ANTHROPIC_API_KEY")
  end
end
