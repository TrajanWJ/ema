defmodule Ema.Quality.ThreatModelAutomaton do
  @moduledoc """
  Periodic threat model checker. Scans for stale proposals, orphaned tasks,
  brain dump bloat, and agent sprawl every 4 hours.
  """

  use GenServer
  require Logger
  import Ecto.Query

  alias Ema.Repo

  @check_interval :timer.hours(4)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def run_check do
    GenServer.call(__MODULE__, :run_check, 30_000)
  end

  def last_report do
    GenServer.call(__MODULE__, :last_report)
  end

  @impl true
  def init(_opts) do
    schedule_check()
    {:ok, %{report: %{findings: [], checked_at: nil}}}
  end

  @impl true
  def handle_call(:run_check, _from, state) do
    report = do_check()
    {:reply, report, %{state | report: report}}
  end

  @impl true
  def handle_call(:last_report, _from, state) do
    {:reply, state.report, state}
  end

  @impl true
  def handle_info(:check, state) do
    report = do_check()
    Phoenix.PubSub.broadcast(Ema.PubSub, "quality:threats", {:threat_report, report})
    schedule_check()
    {:noreply, %{state | report: report}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp schedule_check do
    Process.send_after(self(), :check, @check_interval)
  end

  defp do_check do
    findings =
      [
        check_stale_proposals(),
        check_orphaned_tasks(),
        check_brain_dump_bloat(),
        check_agent_sprawl()
      ]
      |> List.flatten()
      |> Enum.filter(& &1)

    %{findings: findings, checked_at: DateTime.utc_now()}
  end

  defp check_stale_proposals do
    try do
      threshold = DateTime.add(DateTime.utc_now(), -30 * 86400, :second)

      count =
        from(p in "proposals",
          where: p.status in ["queued", "reviewing"] and p.inserted_at < ^threshold,
          select: count(p.id)
        )
        |> Repo.one()

      if count > 0 do
        %{
          type: :stale_proposals,
          severity: if(count > 10, do: :high, else: :medium),
          message: "#{count} proposals pending for >30 days",
          action: "Review and decide on stale proposals"
        }
      end
    rescue
      _ -> nil
    end
  end

  defp check_orphaned_tasks do
    try do
      threshold = DateTime.add(DateTime.utc_now(), -60 * 86400, :second)

      count =
        from(t in "tasks",
          where: is_nil(t.project_id) and t.inserted_at < ^threshold and t.status != "done",
          select: count(t.id)
        )
        |> Repo.one()

      if count > 0 do
        %{
          type: :orphaned_tasks,
          severity: if(count > 20, do: :high, else: :low),
          message: "#{count} tasks without project, older than 60 days",
          action: "Assign projects or archive orphaned tasks"
        }
      end
    rescue
      _ -> nil
    end
  end

  defp check_brain_dump_bloat do
    try do
      count =
        from(b in "brain_dump_items",
          where: b.status != "processed",
          select: count(b.id)
        )
        |> Repo.one()

      if count > 500 do
        %{
          type: :brain_dump_bloat,
          severity: :high,
          message: "#{count} unprocessed brain dump items (>500 threshold)",
          action: "Process or archive brain dump backlog"
        }
      end
    rescue
      _ -> nil
    end
  end

  defp check_agent_sprawl do
    try do
      count =
        from(a in "agents",
          where: a.status == "active",
          select: count(a.id)
        )
        |> Repo.one()

      if count > 20 do
        %{
          type: :agent_sprawl,
          severity: :medium,
          message: "#{count} active agents (>20 threshold)",
          action: "Review and consolidate agent fleet"
        }
      end
    rescue
      _ -> nil
    end
  end
end
