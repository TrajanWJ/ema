defmodule Ema.Intelligence.HealthDigest do
  @moduledoc """
  Daily OTP health digest.

  Once every 24 hours this captures a lightweight snapshot of the BEAM and
  Ema's supervision trees:

    * total memory + breakdown
    * top processes by memory
    * supervisor child counts and any restart intensity
    * largest ETS / Mnesia tables
    * SQLite DB file size
    * uptime

  The result is logged, persisted as a brain dump item, and (if available)
  posted to the babysitter's Discord stream so it surfaces alongside other
  operational signals.

  This is intentionally read-only — it never restarts processes, only
  *observes*. Restart decisions stay with the babysitter / human.
  """

  use GenServer
  require Logger

  @tick_interval_ms :timer.hours(24)
  # Run the first digest a few minutes after boot so the system has time to
  # settle, instead of immediately on startup.
  @initial_delay_ms :timer.minutes(5)

  @top_processes 10
  @top_tables 10

  defstruct last_run_at: nil, last_digest: nil

  # ── Public API ────────────────────────────────────────────────────────────

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Run a digest right now and return the captured snapshot."
  def run_now do
    GenServer.call(__MODULE__, :run_now, 30_000)
  end

  @doc "Return the most recent digest, or nil if none has run yet."
  def last_digest do
    GenServer.call(__MODULE__, :last_digest)
  end

  # ── Callbacks ─────────────────────────────────────────────────────────────

  @impl true
  def init(_opts) do
    Process.send_after(self(), :tick, @initial_delay_ms)
    {:ok, %__MODULE__{}}
  end

  @impl true
  def handle_info(:tick, state) do
    state =
      try do
        run_and_record(state)
      rescue
        e ->
          Logger.error("[HealthDigest] tick failed: #{inspect(e)}")
          state
      end

    Process.send_after(self(), :tick, @tick_interval_ms)
    {:noreply, state}
  end

  @impl true
  def handle_call(:run_now, _from, state) do
    state = run_and_record(state)
    {:reply, {:ok, state.last_digest}, state}
  end

  @impl true
  def handle_call(:last_digest, _from, state) do
    {:reply, state.last_digest, state}
  end

  # ── Internal ──────────────────────────────────────────────────────────────

  defp run_and_record(state) do
    digest = capture()
    Logger.info("[HealthDigest] #{summarize(digest)}")

    persist_brain_dump(digest)
    post_to_babysitter(digest)

    %{state | last_run_at: DateTime.utc_now(), last_digest: digest}
  end

  defp capture do
    %{
      generated_at: DateTime.utc_now() |> DateTime.to_iso8601(),
      uptime_seconds: div(:erlang.statistics(:wall_clock) |> elem(0), 1000),
      memory: capture_memory(),
      top_processes: capture_top_processes(),
      top_tables: capture_top_tables(),
      supervisors: capture_supervisor_health(),
      db_size_bytes: capture_db_size()
    }
  end

  defp capture_memory do
    mem = :erlang.memory()

    %{
      total_mb: bytes_to_mb(mem[:total]),
      processes_mb: bytes_to_mb(mem[:processes]),
      atom_mb: bytes_to_mb(mem[:atom]),
      binary_mb: bytes_to_mb(mem[:binary]),
      ets_mb: bytes_to_mb(mem[:ets])
    }
  end

  defp capture_top_processes do
    Process.list()
    |> Enum.map(fn pid ->
      info = Process.info(pid, [:memory, :registered_name, :message_queue_len])

      case info do
        nil ->
          nil

        info ->
          %{
            pid: inspect(pid),
            name: process_name(info[:registered_name], pid),
            memory_kb: bytes_to_kb(info[:memory] || 0),
            queue: info[:message_queue_len] || 0
          }
      end
    end)
    |> Enum.reject(&is_nil/1)
    |> Enum.sort_by(& &1.memory_kb, :desc)
    |> Enum.take(@top_processes)
  end

  defp process_name([], pid), do: inspect(pid)
  defp process_name(nil, pid), do: inspect(pid)
  defp process_name(name, _pid) when is_atom(name), do: Atom.to_string(name)
  defp process_name(other, _pid), do: inspect(other)

  defp capture_top_tables do
    :ets.all()
    |> Enum.map(fn tab ->
      info = :ets.info(tab)

      if is_list(info) do
        %{
          name: inspect(Keyword.get(info, :name, tab)),
          size: Keyword.get(info, :size, 0),
          memory_kb: bytes_to_kb((Keyword.get(info, :memory, 0) || 0) * :erlang.system_info(:wordsize))
        }
      end
    end)
    |> Enum.reject(&is_nil/1)
    |> Enum.sort_by(& &1.memory_kb, :desc)
    |> Enum.take(@top_tables)
  end

  defp capture_supervisor_health do
    # Best-effort: walk the top-level Ema supervisor and count children per
    # child supervisor. We deliberately swallow errors — health monitoring
    # should never crash the daemon.
    case Process.whereis(Ema.Supervisor) do
      nil ->
        []

      sup ->
        try do
          Supervisor.which_children(sup)
          |> Enum.map(fn {id, pid, type, _modules} ->
            %{
              id: inspect(id),
              type: type,
              alive: is_pid(pid) and Process.alive?(pid),
              child_count: count_children(pid, type)
            }
          end)
        rescue
          _ -> []
        catch
          _, _ -> []
        end
    end
  end

  defp count_children(pid, :supervisor) when is_pid(pid) do
    try do
      length(Supervisor.which_children(pid))
    rescue
      _ -> 0
    catch
      _, _ -> 0
    end
  end

  defp count_children(_pid, _type), do: 0

  defp capture_db_size do
    path = Path.expand("~/.local/share/ema/ema.db")

    case File.stat(path) do
      {:ok, %{size: size}} -> size
      _ -> 0
    end
  end

  defp persist_brain_dump(digest) do
    content = "[Health Digest] " <> summarize(digest)

    if Code.ensure_loaded?(Ema.BrainDump) and
         function_exported?(Ema.BrainDump, :create_item_quiet, 1) do
      try do
        Ema.BrainDump.create_item_quiet(%{content: content, source: "health_digest"})
      rescue
        e -> Logger.warning("[HealthDigest] brain dump persist failed: #{inspect(e)}")
      end
    end
  end

  defp post_to_babysitter(digest) do
    # Reference optional modules dynamically so the compiler doesn't warn when
    # they're absent from the build.
    webhook_mod = Module.concat(Ema.Discord, Webhook)
    babysitter_mod = Module.concat(Ema, Babysitter)

    cond do
      Code.ensure_loaded?(webhook_mod) and
          function_exported?(webhook_mod, :send_message, 2) ->
        try do
          apply(webhook_mod, :send_message, ["babysitter", format_for_discord(digest)])
        rescue
          _ -> :ok
        end

      Code.ensure_loaded?(babysitter_mod) and
          function_exported?(babysitter_mod, :report_health_digest, 1) ->
        try do
          apply(babysitter_mod, :report_health_digest, [digest])
        rescue
          _ -> :ok
        end

      true ->
        :ok
    end
  end

  defp summarize(digest) do
    mem = digest.memory

    "uptime=#{digest.uptime_seconds}s " <>
      "total=#{mem.total_mb}MB " <>
      "procs=#{mem.processes_mb}MB " <>
      "binary=#{mem.binary_mb}MB " <>
      "ets=#{mem.ets_mb}MB " <>
      "db=#{bytes_to_mb(digest.db_size_bytes)}MB"
  end

  defp format_for_discord(digest) do
    """
    **EMA Health Digest — #{digest.generated_at}**
    ```
    #{summarize(digest)}
    top processes:
    #{format_top_list(digest.top_processes, fn p -> "  #{p.name} #{p.memory_kb}KB q=#{p.queue}" end)}
    top tables:
    #{format_top_list(digest.top_tables, fn t -> "  #{t.name} size=#{t.size} #{t.memory_kb}KB" end)}
    ```
    """
  end

  defp format_top_list(items, fmt) do
    items
    |> Enum.map(fmt)
    |> Enum.join("\n")
  end

  defp bytes_to_mb(nil), do: 0
  defp bytes_to_mb(b), do: Float.round(b / 1024 / 1024, 1)

  defp bytes_to_kb(nil), do: 0
  defp bytes_to_kb(b), do: Float.round(b / 1024, 1)
end
