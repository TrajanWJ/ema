defmodule Ema.Evolution.SignalScanner do
  @moduledoc """
  GenServer that scans proposal approval/rejection patterns, task outcomes,
  and user corrections to detect evolution signals. Publishes detected signals
  to PubSub for the Proposer to convert into evolution proposals.
  """

  use GenServer

  require Logger

  @scan_interval :timer.minutes(30)

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def scan_now do
    GenServer.cast(__MODULE__, :scan_now)
  end

  def status do
    GenServer.call(__MODULE__, :status)
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "proposals:events")

    schedule_scan()

    {:ok,
     %{
       total_scans: 0,
       signals_detected: 0,
       last_scan_at: nil,
       approval_patterns: %{},
       rejection_patterns: %{}
     }}
  end

  @impl true
  def handle_cast(:scan_now, state) do
    {:noreply, do_scan(state)}
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply,
     %{
       total_scans: state.total_scans,
       signals_detected: state.signals_detected,
       last_scan_at: state.last_scan_at
     }, state}
  end

  @impl true
  def handle_info(:scheduled_scan, state) do
    schedule_scan()
    {:noreply, do_scan(state)}
  end

  # Track approval patterns in real-time
  def handle_info({"proposal_approved", proposal}, state) do
    tags = extract_tags(proposal)
    patterns = update_patterns(state.approval_patterns, tags)

    state = %{state | approval_patterns: patterns}

    # If we see 3+ approvals in the same tag cluster, emit a signal
    strong_patterns =
      Enum.filter(patterns, fn {_tag, count} -> count >= 3 end)

    state =
      if strong_patterns != [] do
        emit_signal(:approval_pattern, %{
          pattern: "recurring_approval",
          tags: Enum.map(strong_patterns, &elem(&1, 0)),
          counts: Map.new(strong_patterns)
        })

        %{state | signals_detected: state.signals_detected + 1}
      else
        state
      end

    {:noreply, state}
  end

  # Track rejection patterns
  def handle_info({"proposal_killed", proposal}, state) do
    tags = extract_tags(proposal)
    patterns = update_patterns(state.rejection_patterns, tags)

    state = %{state | rejection_patterns: patterns}

    strong_patterns =
      Enum.filter(patterns, fn {_tag, count} -> count >= 3 end)

    state =
      if strong_patterns != [] do
        emit_signal(:approval_pattern, %{
          pattern: "recurring_rejection",
          tags: Enum.map(strong_patterns, &elem(&1, 0)),
          counts: Map.new(strong_patterns)
        })

        %{state | signals_detected: state.signals_detected + 1}
      else
        state
      end

    {:noreply, state}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  # --- Private ---

  defp do_scan(state) do
    Logger.info("SignalScanner: running scan")

    signals_found = scan_task_outcomes() + scan_proposal_trends()

    %{
      state
      | total_scans: state.total_scans + 1,
        signals_detected: state.signals_detected + signals_found,
        last_scan_at: DateTime.utc_now() |> DateTime.truncate(:second)
    }
  end

  defp scan_task_outcomes do
    # Look for tasks that were completed quickly vs ones that stalled
    tasks = Ema.Tasks.list_by_status("done") |> Enum.take(50)

    completed_fast =
      Enum.filter(tasks, fn task ->
        if task.inserted_at && task.updated_at do
          diff = DateTime.diff(task.updated_at, task.inserted_at, :hour)
          diff < 2
        else
          false
        end
      end)

    stalled =
      Ema.Tasks.list_by_status("blocked") |> Enum.take(20)

    signals = 0

    signals =
      if length(completed_fast) > 5 do
        emit_signal(:task_outcome, %{
          pattern: "fast_completions",
          count: length(completed_fast),
          suggestion: "Current workflow produces quickly completable tasks"
        })

        signals + 1
      else
        signals
      end

    if length(stalled) > 3 do
      emit_signal(:task_outcome, %{
        pattern: "stalled_tasks",
        count: length(stalled),
        suggestion: "Multiple blocked tasks indicate a systemic issue"
      })

      signals + 1
    else
      signals
    end
  end

  defp scan_proposal_trends do
    recent = Ema.Proposals.list_proposals(limit: 30)

    approved = Enum.count(recent, &(&1.status == "approved"))
    killed = Enum.count(recent, &(&1.status == "killed"))

    signals = 0

    if length(recent) > 10 and killed > approved * 2 do
      emit_signal(:approval_pattern, %{
        pattern: "high_rejection_rate",
        approved: approved,
        killed: killed,
        suggestion: "Most proposals are being killed — seed quality or prompts may need tuning"
      })

      signals + 1
    else
      signals
    end
  end

  defp emit_signal(source, metadata) do
    Logger.info("SignalScanner: detected signal #{source} — #{inspect(metadata)}")

    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "evolution:signals",
      {:evolution_signal, source, metadata}
    )
  end

  defp extract_tags(proposal) do
    case Map.get(proposal, :tags) do
      tags when is_list(tags) -> Enum.map(tags, & &1.label)
      _ -> []
    end
  end

  defp update_patterns(patterns, tags) do
    Enum.reduce(tags, patterns, fn tag, acc ->
      Map.update(acc, tag, 1, &(&1 + 1))
    end)
  end

  defp schedule_scan do
    Process.send_after(self(), :scheduled_scan, @scan_interval)
  end
end
