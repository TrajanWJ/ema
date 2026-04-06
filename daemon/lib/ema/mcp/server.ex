defmodule Ema.MCP.Server do
  @moduledoc """
  EMA MCP Server — The Central Nervous System.

  Implements the Model Context Protocol (MCP) over stdio so that
  Claude Code CLI (and other MCP clients) can:
    • Read EMA context via Resources
    • Take actions via Tools

  Architecture:
    - Runs as a separate OS process invoked by MCP clients via stdio
    - Or started as a supervised GenServer that owns a stdio port
    - Messages are newline-delimited JSON-RPC 2.0 frames

  Start modes:
    1. Supervised inside EMA daemon:  Ema.MCP.Server.start_link([])
    2. Standalone script:             mix run lib/ema/mcp/server.ex

  Protocol subset implemented:
    initialize          → capabilities handshake
    resources/list      → list all 6 EMA resources
    resources/read      → fetch a specific resource by URI
    tools/list          → list all 5 EMA tools
    tools/call          → invoke a tool with arguments
  """

  use GenServer
  require Logger

  alias Ema.MCP.{Protocol, Resources, Tools, SessionTools, RecursionGuard}

  @server_info %{
    "name" => "ema-mcp-server",
    "version" => "1.0.0"
  }

  @capabilities %{
    "resources" => %{"subscribe" => false, "listChanged" => false},
    "tools" => %{"listChanged" => false}
  }

  # ── Public API ────────────────────────────────────────────────────────────

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Entry point when running as a standalone stdio MCP process.
  Called from a Mix alias or escript.
  """
  def run_stdio do
    quiet_stdio_logging()
    trace("run_stdio:start")
    {:ok, _} = start_link([])
    # Block forever; the GenServer owns stdio
    Process.sleep(:infinity)
  end

  defp quiet_stdio_logging do
    Logger.configure(level: :error)

    with backends when is_list(backends) <- Application.get_env(:logger, :backends, []),
         true <- :console in backends do
      Logger.remove_backend(:console, flush: true)
    else
      _ -> :ok
    end

    :ok
  rescue
    _ -> :ok
  end

  # ── GenServer Callbacks ───────────────────────────────────────────────────

  @impl true
  def init(_opts) do
    # Open stdio port for line-based JSON-RPC communication
    port =
      Port.open({:fd, 0, 1}, [
        :binary,
        :eof,
        {:line, 1_048_576}
      ])

    trace("init:port_opened")

    # Don't log to stdout — it corrupts the MCP protocol
    unless System.get_env("EMA_MCP_STDIO") do
      Logger.info("[MCP] Server started, listening on stdio")
    end

    state = %{
      port: port,
      initialized: false,
      buffer: "",
      # Track in-flight request counts per client ID
      active_calls: %{}
    }

    {:ok, state}
  end

  @impl true
  def handle_info({port, {:data, {:eol, line}}}, %{port: port} = state) do
    trace("handle_info:eol #{inspect(String.trim(line))}")
    state = handle_raw_message(String.trim(line), state)
    {:noreply, state}
  end

  def handle_info({port, {:data, {:noeol, chunk}}}, %{port: port} = state) do
    # Accumulate partial line
    trace("handle_info:noeol #{inspect(chunk)}")
    {:noreply, %{state | buffer: state.buffer <> chunk}}
  end

  def handle_info({port, :eof}, %{port: port} = state) do
    Logger.info("[MCP] Client closed connection (EOF). Shutting down.")
    {:stop, :normal, state}
  end

  def handle_info(msg, state) do
    Logger.debug("[MCP] Unhandled message: #{inspect(msg)}")
    {:noreply, state}
  end

  # ── Private: Message Dispatch ─────────────────────────────────────────────

  defp handle_raw_message("", state), do: state

  defp handle_raw_message(line, state) do
    case Jason.decode(line) do
      {:ok, request} ->
        handle_request(request, state)

      {:error, reason} ->
        Logger.warning("[MCP] JSON decode error: #{inspect(reason)}, line: #{inspect(line)}")
        send_error(state, nil, -32700, "Parse error")
        state
    end
  end

  defp handle_request(request, state) do
    id = Map.get(request, "id")
    method = Map.get(request, "method")
    params = Map.get(request, "params", %{})

    # Notifications (no id) — fire and forget
    if is_nil(id) do
      handle_notification(method, params, state)
      state
    else
      handle_rpc(id, method, params, state)
    end
  end

  defp handle_notification("notifications/cancelled", _params, _state) do
    # Client cancelled a request — we don't need to do anything
    :ok
  end

  defp handle_notification(method, _params, _state) do
    Logger.debug("[MCP] Notification: #{method}")
    :ok
  end

  defp handle_rpc(id, "initialize", params, state) do
    client_info = Map.get(params, "clientInfo", %{})
    Logger.info("[MCP] Client connected: #{inspect(client_info)}")
    trace("rpc:initialize #{inspect(client_info)}")

    response = %{
      "protocolVersion" => "2024-11-05",
      "serverInfo" => @server_info,
      "capabilities" => @capabilities
    }

    send_result(state, id, response)
    %{state | initialized: true}
  end

  defp handle_rpc(id, "resources/list", _params, state) do
    trace("rpc:resources/list")
    resources = Resources.list()
    send_result(state, id, %{"resources" => resources})
    state
  end

  defp handle_rpc(id, "resources/read", params, state) do
    uri = Map.get(params, "uri", "")

    case RecursionGuard.check_depth(uri) do
      :ok ->
        result = Resources.read(uri)
        send_result(state, id, result)

      {:error, :too_deep} ->
        send_error(state, id, -32603, "Recursion depth limit exceeded")
    end

    state
  end

  defp handle_rpc(id, "tools/list", _params, state) do
    trace("rpc:tools/list")
    tools = Tools.list() ++ SessionTools.list()
    send_result(state, id, %{"tools" => tools})
    state
  end

  defp handle_rpc(id, "tools/call", params, state) do
    tool_name = Map.get(params, "name")
    arguments = Map.get(params, "arguments", %{})
    request_id = Map.get(params, "_meta", %{}) |> Map.get("requestId", generate_request_id())

    # Throttle check
    case check_throttle(state, request_id) do
      {:ok, state} ->
        state = increment_active(state, request_id)

        result =
          RecursionGuard.with_depth_check(request_id, fn ->
            if String.starts_with?(tool_name, "ema_") do
              SessionTools.call(tool_name, arguments, request_id)
            else
              Tools.call(tool_name, arguments, request_id)
            end
          end)

        state = decrement_active(state, request_id)

        case result do
          {:ok, content} ->
            send_result(state, id, %{
              "content" => [%{"type" => "text", "text" => Jason.encode!(content)}],
              "isError" => false
            })

          {:error, :recursion_limit} ->
            send_result(state, id, %{
              "content" => [
                %{"type" => "text", "text" => "Recursion depth limit reached — aborting"}
              ],
              "isError" => true
            })

          {:error, reason} ->
            send_result(state, id, %{
              "content" => [%{"type" => "text", "text" => "Tool error: #{inspect(reason)}"}],
              "isError" => true
            })
        end

        state

      {:error, :throttled} ->
        send_error(state, id, -32603, "Too many concurrent MCP calls from this source (max 10)")
        state
    end
  end

  defp handle_rpc(id, method, _params, state) do
    Logger.warning("[MCP] Unknown method: #{method}")
    send_error(state, id, -32601, "Method not found: #{method}")
    state
  end

  # ── Private: Throttling ───────────────────────────────────────────────────

  @max_concurrent 10

  defp check_throttle(state, source_id) do
    current = Map.get(state.active_calls, source_id, 0)

    if current >= @max_concurrent do
      {:error, :throttled}
    else
      {:ok, state}
    end
  end

  defp increment_active(state, source_id) do
    count = Map.get(state.active_calls, source_id, 0)
    %{state | active_calls: Map.put(state.active_calls, source_id, count + 1)}
  end

  defp decrement_active(state, source_id) do
    count = Map.get(state.active_calls, source_id, 1)
    new_count = max(0, count - 1)

    active =
      if new_count == 0 do
        Map.delete(state.active_calls, source_id)
      else
        Map.put(state.active_calls, source_id, new_count)
      end

    %{state | active_calls: active}
  end

  # ── Private: Wire ─────────────────────────────────────────────────────────

  defp send_result(state, id, result) do
    trace("send_result #{inspect(id)}")
    Protocol.send_result(state.port, id, result)
  end

  defp send_error(state, id, code, message) do
    trace("send_error #{inspect(id)} #{inspect(code)} #{inspect(message)}")
    Protocol.send_error(state.port, id, code, message)
  end

  defp generate_request_id do
    :crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)
  end

  defp trace(message) do
    case System.get_env("EMA_MCP_TRACE_FILE") do
      nil ->
        :ok

      path ->
        File.write(path, "#{DateTime.utc_now() |> DateTime.to_iso8601()} #{message}\n", [:append])
    end
  end
end
