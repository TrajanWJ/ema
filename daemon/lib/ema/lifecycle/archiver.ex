defmodule Ema.Lifecycle.Archiver do
  @moduledoc """
  Daily archiver that exports eligible records to JSONL files and deletes them from the DB.

  Archive location: `~/.local/share/ema/archive/{entity_type}/{YYYY-MM}.jsonl`

  Each JSONL line is a complete JSON serialization of the record at the time of archival,
  plus an `_archived_at` timestamp. Archives are append-only — running the archiver
  multiple times in a month appends to the same file.
  """

  use GenServer
  require Logger

  alias Ema.Lifecycle.RetentionPolicy
  alias Ema.Repo

  @archive_base_dir Path.expand("~/.local/share/ema/archive")
  @daily_interval_ms :timer.hours(24)

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Trigger an archive run. Returns `{:ok, summary}` with counts per entity type."
  @spec run_now() :: {:ok, map()}
  def run_now do
    GenServer.call(__MODULE__, :run_now, :timer.minutes(5))
  end

  @doc """
  Dry run — returns what would be archived without modifying anything.
  Returns `%{entity_type => count}`.
  """
  @spec dry_run() :: %{atom() => non_neg_integer()}
  def dry_run do
    RetentionPolicy.eligible_counts()
  end

  @doc "Return the archive base directory path."
  @spec archive_dir() :: String.t()
  def archive_dir, do: @archive_base_dir

  # --- GenServer callbacks ---

  @impl true
  def init(_opts) do
    schedule_next_run()
    {:ok, %{last_run: nil, last_result: nil}}
  end

  @impl true
  def handle_call(:run_now, _from, state) do
    result = do_archive()
    {:reply, {:ok, result}, %{state | last_run: DateTime.utc_now(), last_result: result}}
  end

  @impl true
  def handle_info(:run_archive, state) do
    result = do_archive()
    schedule_next_run()
    {:noreply, %{state | last_run: DateTime.utc_now(), last_result: result}}
  end

  # --- Internals ---

  defp schedule_next_run do
    Process.send_after(self(), :run_archive, @daily_interval_ms)
  end

  defp do_archive do
    Logger.info("[Lifecycle.Archiver] Starting archive run")
    now = DateTime.utc_now()

    summary =
      RetentionPolicy.entity_types()
      |> Enum.map(fn entity_type ->
        case RetentionPolicy.eligible_for_archive(entity_type) do
          {:ok, []} ->
            {entity_type, 0}

          {:ok, records} ->
            archived = archive_and_delete(entity_type, records, now)
            {entity_type, archived}

          {:error, reason} ->
            Logger.warning("[Lifecycle.Archiver] Skipping #{entity_type}: #{inspect(reason)}")
            {entity_type, 0}
        end
      end)
      |> Map.new()

    total = summary |> Map.values() |> Enum.sum()
    Logger.info("[Lifecycle.Archiver] Completed: #{total} records archived across #{map_size(summary)} types")
    summary
  end

  defp archive_and_delete(entity_type, records, now) do
    dir = Path.join(@archive_base_dir, to_string(entity_type))
    File.mkdir_p!(dir)

    file_name = Calendar.strftime(now, "%Y-%m") <> ".jsonl"
    file_path = Path.join(dir, file_name)

    lines =
      Enum.map(records, fn record ->
        record
        |> serialize_record()
        |> Map.put("_archived_at", DateTime.to_iso8601(now))
        |> Map.put("_entity_type", to_string(entity_type))
        |> Jason.encode!()
      end)

    File.write!(file_path, Enum.join(lines, "\n") <> "\n", [:append])

    # Delete from DB
    ids = Enum.map(records, & &1.id)
    schema = record_schema(entity_type)
    delete_records(schema, ids)

    count = length(records)
    Logger.info("[Lifecycle.Archiver] #{entity_type}: archived #{count} records to #{file_path}")
    count
  rescue
    error ->
      Logger.error("[Lifecycle.Archiver] Failed to archive #{entity_type}: #{Exception.message(error)}")
      0
  end

  defp serialize_record(record) do
    record
    |> Map.from_struct()
    |> Map.drop([:__meta__, :__struct__])
    |> drop_associations()
    |> Map.new(fn {k, v} -> {to_string(k), serialize_value(v)} end)
  end

  defp drop_associations(map) do
    Map.reject(map, fn {_k, v} ->
      match?(%Ecto.Association.NotLoaded{}, v)
    end)
  end

  defp serialize_value(%DateTime{} = dt), do: DateTime.to_iso8601(dt)
  defp serialize_value(%NaiveDateTime{} = ndt), do: NaiveDateTime.to_iso8601(ndt)
  defp serialize_value(%Date{} = d), do: Date.to_iso8601(d)
  defp serialize_value(binary) when is_binary(binary), do: binary
  defp serialize_value(other), do: other

  defp record_schema(:inbox_items), do: Ema.BrainDump.Item
  defp record_schema(:proposals), do: Ema.Proposals.Proposal
  defp record_schema(:executions), do: Ema.Executions.Execution
  defp record_schema(:agent_messages), do: Ema.Agents.Message
  defp record_schema(:pipe_runs), do: Ema.Pipes.PipeRun
  defp record_schema(:phase_transitions), do: Ema.Actors.PhaseTransition
  defp record_schema(:claude_sessions), do: Ema.ClaudeSessions.ClaudeSession

  defp delete_records(schema, ids) do
    import Ecto.Query

    schema
    |> where([r], r.id in ^ids)
    |> Repo.delete_all()
  end
end
