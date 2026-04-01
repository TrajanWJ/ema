defmodule Ema.Claude.Adapters.OpenClaw do
  @moduledoc """
  Adapter for the OpenClaw gateway running on the agent VM.

  Since `openclaw` CLI lives on the VM (not the host), we SSH into the VM
  to run `openclaw agent` commands. Supports two modes:

  - `run/3` — one-shot JSON mode for AgentWorker integration
  - `start_session/4` — streaming via Port (SSH + openclaw stream-json)
  """

  @behaviour Ema.Claude.Adapter

  require Logger

  # -- One-shot run (for AgentWorker) -----------------------------------------

  @doc """
  Run a one-shot agent message via SSH → `openclaw agent --json`.
  Returns `{:ok, result_map}` or `{:error, reason}`.
  """
  def run(message, agent_id, opts \\ []) do
    config = openclaw_config()
    ssh_host = Keyword.get(opts, :ssh_host, config[:ssh_host])
    timeout = Keyword.get(opts, :timeout, config[:timeout]) * 1_000

    args = build_ssh_args(ssh_host, message, agent_id, opts)

    case System.cmd("ssh", args, stderr_to_stdout: true, timeout: timeout) do
      {output, 0} ->
        parse_json_output(output)

      {output, code} ->
        Logger.error("openclaw agent failed (exit #{code}): #{String.slice(output, 0, 500)}")
        {:error, {:exit_code, code, String.trim(output)}}
    end
  rescue
    e -> {:error, {:exception, Exception.message(e)}}
  end

  @doc """
  Run an agent message and stream events back via a callback function.
  The callback receives `{:delta, text}`, `{:tool_call, map}`, or `:done`.
  Runs in the calling process (blocking).
  """
  def stream(message, agent_id, callback, opts \\ []) do
    config = openclaw_config()
    ssh_host = Keyword.get(opts, :ssh_host, config[:ssh_host])

    ssh_path = System.find_executable("ssh") || "/usr/bin/ssh"

    args =
      ["-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10", ssh_host] ++
        openclaw_cmd_args(message, agent_id, opts, :stream)

    port =
      Port.open({:spawn_executable, ssh_path}, [
        :binary,
        :exit_status,
        :stderr_to_stdout,
        {:args, args},
        {:line, 65_536}
      ])

    stream_loop(port, callback, "")
  end

  # -- Adapter behaviour callbacks --------------------------------------------

  @impl true
  def start_session(prompt, _session_id, agent_id, opts \\ []) do
    config = openclaw_config()
    ssh_host = Keyword.get(opts, :ssh_host, config[:ssh_host])
    ssh_path = System.find_executable("ssh") || "/usr/bin/ssh"

    args =
      ["-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10", ssh_host] ++
        openclaw_cmd_args(prompt, agent_id, opts, :stream)

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

  @impl true
  def send_message(_port, _message), do: {:error, :not_supported_use_new_session}

  @impl true
  def stop_session(port) when is_port(port) do
    if Port.info(port) != nil, do: Port.close(port)
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
      gateway_url: openclaw_config()[:gateway_url],
      agent_routing: true
    }
  end

  @impl true
  def health_check do
    config = openclaw_config()

    case System.cmd("ssh", [
           "-o", "StrictHostKeyChecking=no",
           "-o", "ConnectTimeout=5",
           config[:ssh_host],
           "openclaw", "status"
         ], stderr_to_stdout: true, timeout: 10_000) do
      {_output, 0} -> :ok
      {output, code} -> {:error, {code, String.trim(output)}}
    end
  rescue
    e -> {:error, {:exception, Exception.message(e)}}
  end

  @impl true
  def parse_event(raw) when is_binary(raw) do
    line = String.trim(raw)
    if line == "", do: :skip, else: do_parse_event(line)
  end

  # -- Private ----------------------------------------------------------------

  defp openclaw_config do
    Application.get_env(:ema, :openclaw, [])
    |> Keyword.put_new(:ssh_host, "192.168.122.10")
    |> Keyword.put_new(:gateway_url, "http://192.168.122.10:18789")
    |> Keyword.put_new(:default_agent, "main")
    |> Keyword.put_new(:timeout, 120)
  end

  defp build_ssh_args(ssh_host, message, agent_id, opts) do
    ["-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10", ssh_host] ++
      openclaw_cmd_args(message, agent_id, opts, :json)
  end

  defp openclaw_cmd_args(message, agent_id, opts, mode) do
    agent = agent_id || Keyword.get(opts, :default_agent) || openclaw_config()[:default_agent]
    thinking = Keyword.get(opts, :thinking, "medium")

    base = ["openclaw", "agent", "--agent", agent, "--thinking", thinking]

    base =
      case mode do
        :json -> base ++ ["--json"]
        :stream -> base ++ ["--json"]
      end

    session_id = Keyword.get(opts, :session_id)
    base = if session_id, do: base ++ ["--session-id", session_id], else: base

    base ++ ["-m", message]
  end

  defp parse_json_output(output) do
    # The output may have plugin log lines before the JSON
    lines = String.split(output, "\n")

    json_line =
      Enum.find(lines, fn line ->
        trimmed = String.trim(line)
        String.starts_with?(trimmed, "{") and String.contains?(trimmed, "\"status\"")
      end)

    case json_line && Jason.decode(String.trim(json_line)) do
      {:ok, %{"status" => "ok", "result" => result}} ->
        text =
          result
          |> Map.get("payloads", [])
          |> Enum.map_join("\n", fn p -> Map.get(p, "text", "") end)

        usage = get_in(result, ["meta", "agentMeta", "usage"]) || %{}

        {:ok,
         %{
           text: text,
           usage: %{
             input_tokens: Map.get(usage, "input", 0),
             output_tokens: Map.get(usage, "output", 0)
           },
           run_id: nil,
           raw: result
         }}

      {:ok, %{"status" => status} = parsed} ->
        {:error, {:openclaw_error, status, Map.get(parsed, "error", "unknown")}}

      nil ->
        # No valid JSON found — return raw output as text
        text = String.trim(output)
        if text == "", do: {:error, :empty_response}, else: {:ok, %{text: text, usage: %{}, raw: nil}}

      {:error, _} ->
        {:error, {:json_parse_error, String.slice(output, 0, 200)}}
    end
  end

  defp stream_loop(port, callback, buffer) do
    receive do
      {^port, {:data, {:eol, line}}} ->
        full_line = buffer <> line
        handle_stream_line(full_line, callback)
        stream_loop(port, callback, "")

      {^port, {:data, {:noeol, chunk}}} ->
        stream_loop(port, callback, buffer <> chunk)

      {^port, {:exit_status, _code}} ->
        callback.(:done)
        :ok
    after
      180_000 ->
        Port.close(port)
        callback.(:done)
        {:error, :timeout}
    end
  end

  defp handle_stream_line(line, callback) do
    trimmed = String.trim(line)

    # Skip plugin log lines and empty lines
    if String.starts_with?(trimmed, "[") or trimmed == "" do
      :skip
    else
      case Jason.decode(trimmed) do
        {:ok, %{"status" => "ok", "result" => result}} ->
          text =
            result
            |> Map.get("payloads", [])
            |> Enum.map_join("\n", fn p -> Map.get(p, "text", "") end)

          if text != "", do: callback.({:delta, text})

        {:ok, %{"type" => "text"} = event} ->
          text = Map.get(event, "text", "")
          if text != "", do: callback.({:delta, text})

        {:ok, %{"type" => "tool_use"} = event} ->
          callback.({:tool_call, event})

        _ ->
          :skip
      end
    end
  end

  defp do_parse_event(line) do
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

      {:ok, %{"status" => "ok", "result" => result}} ->
        text =
          result
          |> Map.get("payloads", [])
          |> Enum.map_join("\n", fn p -> Map.get(p, "text", "") end)

        {:ok, %{type: :message_stop, content: text, raw: result}}

      {:ok, _event} ->
        :skip

      {:error, _} ->
        :skip
    end
  end
end
