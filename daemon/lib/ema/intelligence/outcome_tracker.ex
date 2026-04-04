defmodule Ema.Intelligence.OutcomeTracker do
  @moduledoc """
  Records every agent task outcome for performance and fitness tracking.

  Writes to a JSON file at `@ema_tracker_path` (defaults to ~/.local/share/ema/outcome-tracker.json).
  Keeps the last 500 entries. Safe to call from any process — uses a GenServer for serialized writes.

  Entry format:
    task_id, intent, project, agent, domain, status, tokens_used, time_minutes, quality_score, timestamp
  """

  use GenServer
  require Logger

  @ema_tracker_path Application.compile_env(
                      :ema,
                      :ema_tracker_path,
                      Path.expand("~/.local/share/ema/outcome-tracker.json")
                    )
  @max_entries 500

  # ── Public API ───────────────────────────────────────────────────────────────

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Record an execution outcome. Accepts an `%Ema.Executions.Execution{}` struct.
  """
  def record(execution) do
    GenServer.cast(__MODULE__, {:record, execution})
  end

  @doc """
  Return the N most recent outcomes for a given domain (mode).
  """
  def recent_for_domain(domain, n \\ 3) do
    GenServer.call(__MODULE__, {:recent_for_domain, domain, n})
  end

  @doc """
  Return the raw list of all stored outcomes (newest first).
  """
  def all do
    GenServer.call(__MODULE__, :all)
  end

  # ── GenServer ────────────────────────────────────────────────────────────────

  @impl true
  def init(_opts) do
    Logger.info("[Intelligence.OutcomeTracker] started — tracker: #{@ema_tracker_path}")
    ensure_tracker_dir()
    {:ok, %{}}
  end

  @impl true
  def handle_cast({:record, execution}, state) do
    do_record(execution)
    {:noreply, state}
  end

  @impl true
  def handle_call({:recent_for_domain, domain, n}, _from, state) do
    result =
      read_tracker()
      |> Enum.filter(&(&1["domain"] == domain or &1["mode"] == domain))
      |> Enum.take(n)

    {:reply, result, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, read_tracker(), state}
  end

  # ── Private ──────────────────────────────────────────────────────────────────

  defp do_record(execution) do
    entry = %{
      "task_id" => execution.id,
      "intent" => execution.intent_slug,
      "project" => execution.project_slug,
      "agent" => Map.get(execution.metadata || %{}, "agent_role"),
      "domain" => execution.mode,
      "mode" => execution.mode,
      "status" => execution.status,
      "tokens_used" => nil,
      "time_minutes" => time_minutes(execution),
      "quality_score" => Map.get(execution.metadata || %{}, "quality_score"),
      "timestamp" => DateTime.utc_now() |> DateTime.to_iso8601()
    }

    existing = read_tracker()
    updated = [entry | existing] |> Enum.take(@max_entries)

    case Jason.encode(updated, pretty: true) do
      {:ok, json} ->
        case File.write(@ema_tracker_path, json) do
          :ok ->
            Logger.debug("[OutcomeTracker] Recorded outcome for #{execution.id}")

          {:error, reason} ->
            Logger.warning("[OutcomeTracker] Failed to write tracker: #{inspect(reason)}")
        end

      {:error, reason} ->
        Logger.warning("[OutcomeTracker] Failed to encode entry: #{inspect(reason)}")
    end
  rescue
    e ->
      Logger.warning("[OutcomeTracker] Unexpected error recording outcome: #{inspect(e)}")
  end

  defp time_minutes(execution) do
    case {execution.inserted_at, execution.completed_at} do
      {start, finish} when not is_nil(start) and not is_nil(finish) ->
        DateTime.diff(finish, start, :second) / 60.0

      _ ->
        nil
    end
  end

  defp read_tracker do
    case File.read(@ema_tracker_path) do
      {:ok, content} ->
        case Jason.decode(content) do
          {:ok, list} when is_list(list) -> list
          _ -> []
        end

      _ ->
        []
    end
  end

  defp ensure_tracker_dir do
    dir = Path.dirname(@ema_tracker_path)

    case File.mkdir_p(dir) do
      :ok -> :ok
      {:error, reason} -> Logger.warning("[OutcomeTracker] Could not create dir #{dir}: #{inspect(reason)}")
    end
  end
end
