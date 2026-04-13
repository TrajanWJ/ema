defmodule Ema.Lifecycle.Compactor do
  @moduledoc """
  Weekly compactor that runs SQLite maintenance.

  - Executes `PRAGMA wal_checkpoint(TRUNCATE)` to reclaim WAL disk space
  - Reports table row counts and DB file size
  """

  use GenServer
  require Logger

  alias Ema.Repo

  @weekly_interval_ms :timer.hours(168)

  @tracked_tables ~w(
    inbox_items proposals executions agent_messages agent_conversations
    pipe_runs phase_transitions claude_sessions tasks habits habit_logs
    journal_entries vault_notes vault_links seeds agents actors tags
    entity_data intents intent_links intent_events spaces
  )

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Trigger manual compaction. Returns `{:ok, report}`."
  @spec compact_now() :: {:ok, map()}
  def compact_now do
    GenServer.call(__MODULE__, :compact_now, :timer.minutes(2))
  end

  @doc "Get table sizes without compacting."
  @spec table_stats() :: {:ok, map()}
  def table_stats do
    {:ok, gather_stats()}
  end

  # --- GenServer callbacks ---

  @impl true
  def init(_opts) do
    schedule_next_run()
    {:ok, %{last_run: nil, last_report: nil}}
  end

  @impl true
  def handle_call(:compact_now, _from, state) do
    report = do_compact()
    {:reply, {:ok, report}, %{state | last_run: DateTime.utc_now(), last_report: report}}
  end

  @impl true
  def handle_info(:run_compact, state) do
    report = do_compact()
    schedule_next_run()
    {:noreply, %{state | last_run: DateTime.utc_now(), last_report: report}}
  end

  # --- Internals ---

  defp schedule_next_run do
    Process.send_after(self(), :run_compact, @weekly_interval_ms)
  end

  defp do_compact do
    Logger.info("[Lifecycle.Compactor] Starting compaction")

    # WAL checkpoint
    wal_result = wal_checkpoint()

    # Gather stats
    stats = gather_stats()

    report = %{
      wal_checkpoint: wal_result,
      table_stats: stats,
      db_file_size: db_file_size(),
      compacted_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }

    total_rows = stats |> Map.values() |> Enum.sum()
    Logger.info("[Lifecycle.Compactor] Done: #{total_rows} total rows, DB size: #{format_bytes(report.db_file_size)}")

    report
  end

  defp wal_checkpoint do
    case Ecto.Adapters.SQL.query(Repo, "PRAGMA wal_checkpoint(TRUNCATE)", []) do
      {:ok, result} ->
        Logger.info("[Lifecycle.Compactor] WAL checkpoint complete")
        %{status: :ok, rows: result.rows}

      {:error, reason} ->
        Logger.warning("[Lifecycle.Compactor] WAL checkpoint failed: #{inspect(reason)}")
        %{status: :error, reason: inspect(reason)}
    end
  end

  defp gather_stats do
    @tracked_tables
    |> Enum.map(fn table ->
      count =
        case Ecto.Adapters.SQL.query(Repo, "SELECT COUNT(*) FROM #{table}", []) do
          {:ok, %{rows: [[n]]}} -> n
          _ -> -1
        end

      {table, count}
    end)
    |> Map.new()
  end

  defp db_file_size do
    db_path = Application.get_env(:ema, Ema.Repo)[:database] || "~/.local/share/ema/ema.db"
    path = Path.expand(db_path)

    case File.stat(path) do
      {:ok, %{size: size}} -> size
      _ -> 0
    end
  end

  defp format_bytes(bytes) when bytes >= 1_048_576, do: "#{Float.round(bytes / 1_048_576, 1)} MB"
  defp format_bytes(bytes) when bytes >= 1_024, do: "#{Float.round(bytes / 1_024, 1)} KB"
  defp format_bytes(bytes), do: "#{bytes} B"
end
