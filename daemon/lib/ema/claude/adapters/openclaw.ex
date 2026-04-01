defmodule Ema.Claude.Adapters.OpenClaw do
  @moduledoc """
  Adapter for the OpenClaw gateway.

  Wraps `openclaw agent run --print --output-format stream-json --agent <agent_id>`
  via an Erlang Port. Supports configurable gateway URL via the `OPENCLAW_GATEWAY_URL`
  environment variable or application config.

  The gateway URL is used to target a specific OpenClaw instance (local or remote).
  """

  @behaviour Ema.Claude.Adapter

  require Logger

  @default_gateway_url "http://localhost:18789"

  @impl true
  def start_session(prompt, _session_id, agent_id, opts \\ []) do
    case System.find_executable("openclaw") do
      nil ->
        {:error, :openclaw_not_found}

      openclaw_path ->
        gateway_url = Keyword.get(opts, :gateway_url, get_gateway_url())
        args = build_args(prompt, agent_id, gateway_url, opts)

        env =
          if gateway_url do
            [{"OPENCLAW_GATEWAY_URL", gateway_url}]
          else
            []
          end

        port =
          Port.open({:spawn_executable, openclaw_path}, [
            :binary,
            :exit_status,
            :stderr_to_stdout,
            {:args, args},
            {:line, 65_536},
            {:env, env}
          ])

        {:ok, port}
    end
  end

  @impl true
  def send_message(port, _message) when is_port(port) do
    {:error, :not_supported_use_new_session}
  end

  @impl true
  def stop_session(port) when is_port(port) do
    if Port.info(port) != nil do
      Port.close(port)
    end

    :ok
  end

  @impl true
  def capabilities do
    %{
      streaming: true,
      multi_turn: false,
      tool_use: true,
      models: [],
      task_types: [:code_generation, :code_review, :research, :creative, :general, :summarization],
      gateway_url: get_gateway_url(),
      agent_routing: true
    }
  end

  @impl true
  def health_check do
    case System.find_executable("openclaw") do
      nil ->
        {:error, :openclaw_not_found}

      openclaw_path ->
        case System.cmd(openclaw_path, ["status"], stderr_to_stdout: true, timeout: 5_000) do
          {_output, 0} -> :ok
          {output, code} -> {:error, {code, String.trim(output)}}
        end
    end
  end

  @impl true
  def parse_event(raw) when is_binary(raw) do
    line = String.trim(raw)

    if line == "" do
      :skip
    else
      case Jason.decode(line) do
        {:ok, %{"type" => "text"} = event} ->
          {:ok, %{type: :text_delta, content: event["text"] || "", raw: event}}

        {:ok, %{"type" => "result"} = event} ->
          {:ok,
           %{
             type: :message_stop,
             content: event["result"] || "",
             usage: %{
               tokens_in: get_in(event, ["usage", "input_tokens"]) || 0,
               tokens_out: get_in(event, ["usage", "output_tokens"]) || 0
             },
             raw: event
           }}

        {:ok, %{"type" => "error"} = event} ->
          {:error, %{message: event["message"] || "Unknown error", raw: event}}

        {:ok, %{"type" => type}} when type in ["system"] ->
          :skip

        {:ok, event} ->
          {:ok, %{type: :unknown, raw: event}}

        {:error, _} ->
          :skip
      end
    end
  end

  # Private helpers

  defp build_args(prompt, agent_id, _gateway_url, _opts) do
    base = [
      "agent",
      "run",
      "--print",
      "--output-format",
      "stream-json"
    ]

    base = if agent_id && agent_id != "", do: base ++ ["--agent", agent_id], else: base
    base ++ [prompt]
  end

  defp get_gateway_url do
    System.get_env("OPENCLAW_GATEWAY_URL") ||
      Application.get_env(:ema, :openclaw_gateway_url, @default_gateway_url)
  end
end
