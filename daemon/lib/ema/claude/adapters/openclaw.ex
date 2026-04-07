defmodule Ema.Claude.Adapters.OpenClaw do
  @moduledoc """
  Adapter for the OpenClaw gateway on the agent VM.

  Dispatches to agents via SSH + `openclaw agent` CLI on the VM.
  The gateway web UI runs at the gateway URL but has no REST dispatch API —
  all agent dispatch goes through the CLI with `--json` output.

  Health check probes the gateway HTTP port to confirm it's running.
  """

  @behaviour Ema.Claude.Adapter

  require Logger

  @default_gateway_url "http://192.168.122.10:18789"
  @default_timeout_s 120

  # ── Adapter Callbacks ─────────────────────────────────────────────────────

  @impl true
  def capabilities do
    %{
      streaming: false,
      multi_turn: false,
      tool_use: true,
      models: [],
      task_types: [:code_generation, :code_review, :research, :creative, :general, :summarization],
      gateway_url: gateway_url(),
      agent_routing: true
    }
  end

  @impl true
  def health_check do
    url = gateway_url()

    case Req.get(url, receive_timeout: 5_000) do
      {:ok, %{status: 200}} -> :ok
      {:ok, %{status: code}} -> {:error, {:http_error, code}}
      {:error, %{reason: :econnrefused}} -> {:error, :gateway_unreachable}
      {:error, reason} -> {:error, reason}
    end
  rescue
    e -> {:error, Exception.message(e)}
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

        {:ok, %{"type" => "system"}} ->
          :skip

        {:ok, event} ->
          {:ok, %{type: :unknown, raw: event}}

        {:error, _} ->
          :skip
      end
    end
  end

  @impl true
  def start_session(prompt, _session_id, agent_id, opts \\ []) do
    dispatch_ssh(prompt, agent_id, opts)
  end

  @impl true
  def send_message(_session, _message) do
    {:error, :not_supported_use_new_session}
  end

  @impl true
  def stop_session(port) when is_port(port) do
    if Port.info(port) != nil do
      Port.close(port)
    end

    :ok
  end

  def stop_session(_), do: :ok

  # ── SSH + CLI Dispatch ────────────────────────────────────────────────────

  @doc """
  Dispatch via SSH to the agent VM, running `openclaw agent` remotely.
  Returns an Erlang Port that will emit JSON on completion.

  The CLI supports `--json` for structured output and `--deliver` to
  push the reply back to the agent's configured channel (e.g., Discord).
  """
  def dispatch_ssh(prompt, agent_id, opts \\ []) do
    ssh_path = System.find_executable("ssh")

    if is_nil(ssh_path) do
      {:error, :ssh_not_found}
    else
      host = ssh_host()
      timeout = Keyword.get(opts, :timeout, @default_timeout_s)
      deliver? = Keyword.get(opts, :deliver, false)

      remote_cmd =
        ["openclaw", "agent"] ++
          agent_args(agent_id) ++
          ["--message", shell_escape(prompt), "--json", "--timeout", to_string(timeout)] ++
          if(deliver?, do: ["--deliver"], else: [])

      args = [host, Enum.join(remote_cmd, " ")]

      port =
        Port.open({:spawn_executable, ssh_path}, [
          :binary,
          :exit_status,
          :stderr_to_stdout,
          {:args, args},
          {:line, 65_536}
        ])

      {:ok, port}
    end
  end

  @doc """
  Run a synchronous agent call via SSH. Blocks until completion.
  Returns `{:ok, result_map}` or `{:error, reason}`.

  Result map keys:
  - `:text` — agent response text
  - `:run_id` — OpenClaw run ID
  - `:agent` — agent ID used
  - `:model` — model used
  - `:usage` — token usage map
  - `:duration_ms` — execution time
  """
  def run(prompt, agent_id \\ "main", opts \\ []) do
    host = ssh_host()
    timeout = Keyword.get(opts, :timeout, @default_timeout_s)
    deliver? = Keyword.get(opts, :deliver, false)

    remote_cmd =
      ["openclaw", "agent"] ++
        agent_args(agent_id) ++
        ["--message", shell_escape(prompt), "--json", "--timeout", to_string(timeout)] ++
        if(deliver?, do: ["--deliver"], else: [])

    task =
      Task.async(fn ->
        System.cmd("ssh", [host, Enum.join(remote_cmd, " ")], stderr_to_stdout: true)
      end)

    case Task.yield(task, (timeout + 10) * 1_000) || Task.shutdown(task) do
      {:ok, {output, 0}} ->
        parse_json_result(output, agent_id)

      {:ok, {output, code}} ->
        {:error, {:exit_code, code, String.trim(output)}}

      nil ->
        {:error, :timeout}
    end
  rescue
    e -> {:error, Exception.message(e)}
  end

  # ── Result Parsing ────────────────────────────────────────────────────────

  defp parse_json_result(output, agent_id) do
    # openclaw agent --json outputs a single JSON object
    case Jason.decode(String.trim(output)) do
      {:ok, %{"status" => "ok", "result" => result}} ->
        payloads = get_in(result, ["payloads"]) || []
        text = payloads |> Enum.map_join("\n", & &1["text"]) |> String.trim()
        meta = get_in(result, ["meta", "agentMeta"]) || %{}

        {:ok,
         %{
           text: text,
           run_id: result["runId"],
           agent: agent_id,
           model: meta["model"],
           usage: %{
             input_tokens: get_in(meta, ["usage", "input"]) || 0,
             output_tokens: get_in(meta, ["usage", "output"]) || 0,
             cache_read: get_in(meta, ["usage", "cacheRead"]) || 0
           },
           duration_ms: get_in(result, ["meta", "durationMs"]) || 0
         }}

      {:ok, %{"status" => status} = body} ->
        {:error, {:openclaw_error, status, body["summary"] || "unknown error"}}

      {:error, _} ->
        # Not JSON — probably stderr noise before the JSON
        case extract_json(output) do
          {:ok, json} -> parse_json_result(json, agent_id)
          :error -> {:error, {:invalid_output, String.slice(output, 0, 500)}}
        end
    end
  end

  defp extract_json(output) do
    # Find the first { and last } to extract JSON from mixed output
    case Regex.run(~r/\{.*\}/s, output) do
      [json] -> {:ok, json}
      _ -> :error
    end
  end

  # ── Config ────────────────────────────────────────────────────────────────

  def gateway_url do
    System.get_env("OPENCLAW_GATEWAY_URL") ||
      Application.get_env(:ema, :openclaw_gateway_url, @default_gateway_url)
  end

  defp ssh_host do
    System.get_env("OPENCLAW_SSH_HOST") ||
      Application.get_env(:ema, :openclaw_ssh_host, "trajan@192.168.122.10")
  end

  defp agent_args(nil), do: []
  defp agent_args(""), do: []
  defp agent_args(agent_id), do: ["--agent", agent_id]

  defp shell_escape(str) do
    "'" <> String.replace(str, "'", "'\\''") <> "'"
  end
end
