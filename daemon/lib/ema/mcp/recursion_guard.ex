defmodule Ema.MCP.RecursionGuard do
  @moduledoc """
  Prevents infinite recursion in MCP call chains.

  The dangerous loop is: Claude Code → EMA MCP → Claude Bridge → Claude Code → ...

  This module tracks the current call depth and enforces a limit.
  It also tracks request IDs to detect cross-request loops.

  Depth semantics:
    0 = Top-level external call (Claude Code → EMA)
    1 = EMA calls Claude Bridge internally
    2 = Claude Bridge calls back into EMA via MCP (allowed once)
    3 = BLOCKED — would be infinite loop

  Implementation:
    - Depth is stored in the Process dictionary (per-process, per-call)
    - For cross-process depth, we use an ETS table keyed by request_id
    - The X-MCP-Depth header propagates depth to the EMA REST API
  """

  require Logger

  @max_depth 2
  @table :mcp_recursion_guard
  @process_key :mcp_call_depth

  # ── Startup ───────────────────────────────────────────────────────────────

  @doc """
  Initialize the ETS table. Call once during application startup.
  Should be called from a supervisor or Application.start/2.
  """
  def init do
    if :ets.whereis(@table) == :undefined do
      :ets.new(@table, [:named_table, :public, :set, {:write_concurrency, true}])
      Logger.debug("[MCP RecursionGuard] ETS table initialized")
    end

    :ok
  end

  # ── Depth Check ───────────────────────────────────────────────────────────

  @doc """
  Check if the current call depth is within allowed limits.
  Returns :ok or {:error, :too_deep}.

  Uses the process dictionary depth if available, otherwise ETS.
  """
  def check_depth(context \\ nil) do
    depth = current_depth()

    if depth > @max_depth do
      Logger.warning(
        "[MCP RecursionGuard] Depth limit exceeded (depth=#{depth}, max=#{@max_depth}, context=#{inspect(context)})"
      )

      {:error, :too_deep}
    else
      :ok
    end
  end

  @doc """
  Execute a function with depth tracking.
  Increments depth before calling, decrements after.
  Blocks if depth limit would be exceeded.
  """
  def with_depth_check(request_id, fun) do
    current = current_depth()

    if current >= @max_depth do
      Logger.warning(
        "[MCP RecursionGuard] Blocking call — depth limit (request_id=#{request_id}, depth=#{current})"
      )

      {:error, :recursion_limit}
    else
      push_depth(request_id)

      try do
        fun.()
      after
        pop_depth(request_id)
      end
    end
  end

  @doc """
  Get the current recursion depth for this process.
  Returns 0 if not in a recursive call.
  """
  def current_depth do
    Process.get(@process_key, 0)
  end

  @doc """
  Set the depth for the current process based on an inbound X-MCP-Depth header.
  Used by the EMA REST API to propagate depth from the MCP client.
  """
  def set_depth_from_header(header_value) when is_binary(header_value) do
    case Integer.parse(header_value) do
      {depth, ""} ->
        Process.put(@process_key, depth)
        :ok

      _ ->
        Logger.warning("[MCP RecursionGuard] Invalid depth header: #{inspect(header_value)}")
        :ok
    end
  end

  def set_depth_from_header(_), do: :ok

  # ── Request ID Tracking ───────────────────────────────────────────────────

  @doc """
  Register a new MCP request ID in ETS.
  Returns :ok or {:error, :duplicate} if already seen (loop detection).
  """
  def register_request(request_id) do
    ensure_table()
    now = System.system_time(:second)

    case :ets.insert_new(@table, {request_id, now, current_depth()}) do
      true ->
        :ok

      false ->
        Logger.warning("[MCP RecursionGuard] Duplicate request_id detected: #{request_id}")
        {:error, :duplicate}
    end
  end

  @doc """
  Release a request ID from tracking (call when request completes).
  """
  def release_request(request_id) do
    ensure_table()
    :ets.delete(@table, request_id)
    :ok
  end

  @doc """
  Clean up stale request IDs older than TTL seconds.
  Should be called periodically (e.g., by a GenServer timer).
  """
  def cleanup_stale(ttl_seconds \\ 300) do
    ensure_table()
    cutoff = System.system_time(:second) - ttl_seconds

    stale =
      :ets.select(@table, [
        {{"$1", "$2", "$3"}, [{:<, "$2", cutoff}], ["$1"]}
      ])

    Enum.each(stale, &:ets.delete(@table, &1))

    if length(stale) > 0 do
      Logger.debug("[MCP RecursionGuard] Cleaned #{length(stale)} stale request IDs")
    end

    :ok
  end

  @doc """
  Returns current stats for monitoring.
  """
  def stats do
    ensure_table()

    %{
      active_requests: :ets.info(@table, :size),
      current_process_depth: current_depth(),
      max_depth: @max_depth
    }
  end

  # ── Private ───────────────────────────────────────────────────────────────

  defp push_depth(request_id) do
    new_depth = current_depth() + 1
    Process.put(@process_key, new_depth)

    ensure_table()
    now = System.system_time(:second)
    :ets.insert(@table, {request_id, now, new_depth})

    Logger.debug("[MCP RecursionGuard] Depth push → #{new_depth} (request=#{request_id})")
  end

  defp pop_depth(request_id) do
    new_depth = max(0, current_depth() - 1)
    Process.put(@process_key, new_depth)

    ensure_table()
    :ets.delete(@table, request_id)

    Logger.debug("[MCP RecursionGuard] Depth pop → #{new_depth} (request=#{request_id})")
  end

  defp ensure_table do
    if :ets.whereis(@table) == :undefined do
      init()
    end
  end
end
