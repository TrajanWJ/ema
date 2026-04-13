defmodule Ema.Executions.Janitor do
  @moduledoc """
  Hourly cleanup pass over the executions table.

  Marks executions stuck in a "running" (or other in-flight) status for longer
  than `@stuck_after_hours` as `failed` with a `stuck_timeout` reason. We
  intentionally do *not* auto-restart — the user surfaces the failure via the
  daily brief and decides whether to retry.

  Runs once at boot (after a short warmup delay) and then hourly.
  """

  use GenServer
  require Logger

  import Ecto.Query

  alias Ema.Executions
  alias Ema.Executions.Execution
  alias Ema.Repo

  # Tickled hourly, with a small jitter to avoid colliding with other periodic
  # workers that boot at the same time.
  @tick_interval_ms :timer.hours(1)
  @initial_delay_ms :timer.minutes(2)
  @stuck_after_hours 6
  @in_flight_statuses ~w(running approved delegated harvesting)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Force a sweep right now (returns the number of executions marked failed)."
  def sweep_now do
    GenServer.call(__MODULE__, :sweep_now, 30_000)
  end

  # ── Callbacks ─────────────────────────────────────────────────────────────

  @impl true
  def init(_opts) do
    Process.send_after(self(), :tick, @initial_delay_ms)
    {:ok, %{last_run: nil, last_count: 0}}
  end

  @impl true
  def handle_info(:tick, state) do
    count = sweep()
    Process.send_after(self(), :tick, @tick_interval_ms)
    {:noreply, %{state | last_run: DateTime.utc_now(), last_count: count}}
  end

  @impl true
  def handle_call(:sweep_now, _from, state) do
    count = sweep()
    {:reply, count, %{state | last_run: DateTime.utc_now(), last_count: count}}
  end

  # ── Internal ──────────────────────────────────────────────────────────────

  defp sweep do
    cutoff =
      DateTime.utc_now()
      |> DateTime.add(-@stuck_after_hours * 3600, :second)
      |> DateTime.truncate(:second)

    stuck =
      Execution
      |> where([e], e.status in ^@in_flight_statuses)
      |> where([e], e.updated_at < ^cutoff)
      |> Repo.all()

    Enum.each(stuck, &mark_failed/1)

    if stuck != [] do
      Logger.warning(
        "[Executions.Janitor] marked #{length(stuck)} stuck executions as failed (>#{@stuck_after_hours}h)"
      )
    end

    length(stuck)
  end

  defp mark_failed(%Execution{} = execution) do
    metadata =
      (execution.metadata || %{})
      |> Map.put("janitor", %{
        "reason" => "stuck_timeout",
        "stuck_after_hours" => @stuck_after_hours,
        "marked_at" => DateTime.utc_now() |> DateTime.to_iso8601()
      })

    changeset =
      Execution.changeset(execution, %{
        status: "failed",
        completed_at: DateTime.utc_now() |> DateTime.truncate(:second),
        metadata: metadata
      })

    case Repo.update(changeset) do
      {:ok, updated} ->
        Executions.record_event(updated.id, "stuck_timeout", %{
          previous_status: execution.status,
          stuck_after_hours: @stuck_after_hours
        })

        Phoenix.PubSub.broadcast(
          Ema.PubSub,
          "executions",
          {"execution:updated", updated}
        )

        :ok

      {:error, reason} ->
        Logger.error(
          "[Executions.Janitor] failed to mark #{execution.id} as failed: #{inspect(reason)}"
        )
    end
  end
end
