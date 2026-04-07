defmodule Ema.Claude.Adapters.OpenClaw do
  @moduledoc """
  Adapter for the OpenClaw gateway on the agent VM.

  Primary: HTTP to gateway REST API at `OPENCLAW_GATEWAY_URL`.
  Fallback: SSH + CLI when gateway is unreachable.
  """

  @behaviour Ema.Claude.Adapter

  require Logger

  @default_gateway_url "http://192.168.122.10:18789"
  @poll_interval_ms 1_000
  @poll_timeout_ms 120_000

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
    url = "#{gateway_url()}/rest/agents"

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
    case dispatch_http(prompt, agent_id, opts) do
      {:ok, pid} ->
        {:ok, pid}

      {:error, :gateway_unreachable} ->
        Logger.warning("[OpenClaw] Gateway unreachable, falling back to SSH")
        dispatch_ssh(prompt, agent_id, opts)

      error ->
        error
    end
  end

  @impl true
  def send_message(_session, _message) do
    {:error, :not_supported_use_new_session}
  end

  @impl true
  def stop_session(pid) when is_pid(pid) do
    if Process.alive?(pid) do
      Process.exit(pid, :normal)
    end

    :ok
  end

  def stop_session(port) when is_port(port) do
    if Port.info(port) != nil do
      Port.close(port)
    end

    :ok
  end

  def stop_session(_), do: :ok

  # ── HTTP Dispatch ─────────────────────────────────────────────────────────

  @doc """
  Dispatch a prompt to the OpenClaw gateway via HTTP.
  Starts a poller process that polls for completion and returns results.
  """
  def dispatch_http(prompt, agent_id, opts \\ []) do
    url = "#{gateway_url()}/rest/sessions"

    body = %{
      "agent" => agent_id || "main",
      "prompt" => prompt,
      "opts" => Map.new(opts)
    }

    case Req.post(url, json: body, receive_timeout: 10_000) do
      {:ok, %{status: status, body: %{"session_id" => session_id}}} when status in [200, 201] ->
        {:ok, spawn_poller(session_id, opts)}

      {:ok, %{status: code, body: body}} ->
        {:error, {:http_error, code, body}}

      {:error, %{reason: :econnrefused}} ->
        {:error, :gateway_unreachable}

      {:error, reason} ->
        {:error, reason}
    end
  rescue
    e -> {:error, Exception.message(e)}
  end

  defp spawn_poller(session_id, opts) do
    caller = self()
    timeout = Keyword.get(opts, :timeout, @poll_timeout_ms)

    spawn_link(fn ->
      result = poll_until_complete(session_id, timeout)
      send(caller, {:openclaw_result, session_id, result})
    end)
  end

  defp poll_until_complete(session_id, timeout) do
    deadline = System.monotonic_time(:millisecond) + timeout
    do_poll(session_id, deadline)
  end

  defp do_poll(session_id, deadline) do
    if System.monotonic_time(:millisecond) > deadline do
      {:error, :timeout}
    else
      url = "#{gateway_url()}/rest/sessions/#{session_id}"

      case Req.get(url, receive_timeout: 5_000) do
        {:ok, %{status: 200, body: %{"status" => "completed"} = body}} ->
          {:ok,
           %{
             text: body["result"] || body["output"] || "",
             usage: %{
               input_tokens: get_in(body, ["usage", "input_tokens"]) || 0,
               output_tokens: get_in(body, ["usage", "output_tokens"]) || 0
             },
             session_id: session_id
           }}

        {:ok, %{status: 200, body: %{"status" => "failed"} = body}} ->
          {:error, body["error"] || "session failed"}

        {:ok, %{status: 200, body: %{"status" => _running}}} ->
          Process.sleep(@poll_interval_ms)
          do_poll(session_id, deadline)

        {:ok, %{status: 404}} ->
          {:error, :session_not_found}

        {:ok, %{status: code}} ->
          {:error, {:http_error, code}}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  # ── SSH Fallback ──────────────────────────────────────────────────────────

  @doc """
  Dispatch via SSH to the agent VM, running `openclaw agent run` remotely.
  Returns an Erlang Port for stream-json output.
  """
  def dispatch_ssh(prompt, agent_id, _opts) do
    ssh_path = System.find_executable("ssh")

    if is_nil(ssh_path) do
      {:error, :ssh_not_found}
    else
      ssh_host = ssh_host()

      args = [
        ssh_host,
        "openclaw", "agent", "run",
        "--print",
        "--output-format", "stream-json",
        "--agent", agent_id || "main",
        prompt
      ]

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

  # ── Config ────────────────────────────────────────────────────────────────

  def gateway_url do
    System.get_env("OPENCLAW_GATEWAY_URL") ||
      Application.get_env(:ema, :openclaw_gateway_url, @default_gateway_url)
  end

  defp ssh_host do
    System.get_env("OPENCLAW_SSH_HOST") ||
      Application.get_env(:ema, :openclaw_ssh_host, "trajan@192.168.122.10")
  end
end
