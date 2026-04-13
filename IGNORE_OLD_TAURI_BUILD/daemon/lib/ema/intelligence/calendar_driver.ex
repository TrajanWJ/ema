defmodule Ema.Intelligence.CalendarDriver do
  @moduledoc """
  Reads intents, calendar brain dumps, and goal timeframes to drive autonomous work.

  Surfaces "what should be worked on now" based on commitments — the long-term
  plan — not just current state. Designed to keep EMA driving toward the planned
  trajectory without requiring constant user steering.

  The driver runs every 15 minutes:

  1. Parses brain dumps tagged "CALENDAR" or containing TIMEFRAME markers
  2. Pulls intents whose description carries timeframe language
  3. Pulls goals approaching the end of their timeframe window
  4. For each item, checks whether an active task already exists
  5. If not, creates a surfaced task (status: "todo", source_type: "calendar_driver")
  6. Broadcasts a recommendation event so the babysitter / brief can pick it up

  By design the driver **surfaces, never auto-executes**. The user (or a
  downstream approval flow) is still in the loop for dispatch.
  """

  use GenServer
  require Logger

  alias Ema.{BrainDump, Goals, Intents, Tasks}

  @check_interval :timer.minutes(15)
  @pubsub Ema.PubSub
  @topic "calendar:driver"
  @source_type "calendar_driver"

  # Heuristic: words/phrases that suggest a calendar commitment
  @calendar_markers ["CALENDAR", "TIMEFRAME:", "this week", "next week",
                     "this month", "next month", "Q1", "Q2", "Q3", "Q4",
                     "by end of", "deadline:"]

  ## Public API

  def start_link(_opts), do: GenServer.start_link(__MODULE__, :ok, name: __MODULE__)

  @doc "Manually trigger one drive_forward pass. Returns the surface report."
  def drive_now, do: GenServer.call(__MODULE__, :drive_now, 30_000)

  @doc """
  Returns `{:ok, recommendation, reason}` or `{:idle, message}` for the
  highest-leverage thing to work on right now based on calendar pressure.
  """
  def next_action, do: GenServer.call(__MODULE__, :next_action, 10_000)

  @doc "Returns map: %{this_week: %{...}, this_month: %{...}, ...}"
  def progress_summary, do: GenServer.call(__MODULE__, :progress_summary, 10_000)

  @doc "Returns the list of items found in the most recent drive_forward pass."
  def last_report, do: GenServer.call(__MODULE__, :last_report, 5_000)

  ## GenServer

  @impl true
  def init(:ok) do
    schedule_check()
    {:ok, %{last_check: nil, last_report: %{items: [], surfaced: []}}}
  end

  @impl true
  def handle_info(:check, state) do
    report = safe_drive_forward()
    schedule_check()
    {:noreply, %{state | last_check: DateTime.utc_now(), last_report: report}}
  end

  @impl true
  def handle_call(:drive_now, _from, state) do
    report = safe_drive_forward()
    {:reply, report, %{state | last_check: DateTime.utc_now(), last_report: report}}
  end

  def handle_call(:next_action, _from, state) do
    {:reply, do_next_action(), state}
  end

  def handle_call(:progress_summary, _from, state) do
    {:reply, do_progress_summary(), state}
  end

  def handle_call(:last_report, _from, state) do
    {:reply, state.last_report, state}
  end

  ## Drive loop

  defp safe_drive_forward do
    drive_forward()
  rescue
    err ->
      Logger.error("CalendarDriver crash: #{inspect(err)}")
      %{items: [], surfaced: [], error: inspect(err)}
  end

  defp drive_forward do
    items =
      parse_calendar_items() ++
        timed_intents_as_items() ++
        urgent_goals_as_items()

    surfaced =
      items
      |> Enum.uniq_by(& &1.dedupe_key)
      |> Enum.map(&maybe_create_task/1)
      |> Enum.reject(&is_nil/1)

    if surfaced != [] do
      Phoenix.PubSub.broadcast(
        @pubsub,
        @topic,
        {:calendar_surfaced, surfaced}
      )

      Logger.info("CalendarDriver surfaced #{length(surfaced)} item(s)")
    end

    %{items: items, surfaced: surfaced, ran_at: DateTime.utc_now()}
  end

  ## Calendar brain dumps

  defp parse_calendar_items do
    BrainDump.list_items()
    |> Enum.filter(&calendar_item?/1)
    |> Enum.map(&parse_brain_dump_item/1)
  end

  defp calendar_item?(%{content: nil}), do: false

  defp calendar_item?(%{content: content}) when is_binary(content) do
    Enum.any?(@calendar_markers, &String.contains?(content, &1))
  end

  defp calendar_item?(_), do: false

  defp parse_brain_dump_item(item) do
    timeframe = parse_timeframe(item.content)
    title = brain_dump_title(item.content)

    %{
      kind: :brain_dump,
      source_id: item.id,
      title: title,
      description: item.content,
      timeframe: timeframe,
      urgency: timeframe_urgency(timeframe),
      dedupe_key: "bd:#{item.id}"
    }
  end

  defp brain_dump_title(content) do
    content
    |> String.split("\n", parts: 2)
    |> List.first()
    |> String.replace(~r/^CALENDAR:?\s*/i, "")
    |> String.replace(~r/^TIMEFRAME:?\s*\S+\s*/i, "")
    |> String.slice(0, 120)
    |> String.trim()
    |> case do
      "" -> "Calendar item"
      t -> t
    end
  end

  defp parse_timeframe(content) when is_binary(content) do
    cond do
      String.contains?(content, "today") -> :today
      String.contains?(content, "this week") -> :this_week
      String.contains?(content, "next week") -> :next_week
      String.contains?(content, "next 2 weeks") -> :two_weeks
      String.contains?(content, "this month") -> :this_month
      String.contains?(content, "next month") -> :next_month
      String.contains?(content, "Q1") -> :q1
      String.contains?(content, "Q2") -> :q2
      String.contains?(content, "Q3") -> :q3
      String.contains?(content, "Q4") -> :q4
      true -> :unspecified
    end
  end

  defp parse_timeframe(_), do: :unspecified

  ## Timed intents

  defp timed_intents_as_items do
    Intents.list_intents(status: "active")
    |> Enum.filter(&intent_has_timeframe?/1)
    |> Enum.map(fn intent ->
      timeframe = parse_timeframe(intent.description || "")

      %{
        kind: :intent,
        source_id: intent.id,
        title: intent.title,
        description: intent.description || "",
        timeframe: timeframe,
        urgency: timeframe_urgency(timeframe) + intent_priority_boost(intent),
        dedupe_key: "intent:#{intent.id}"
      }
    end)
  end

  defp intent_has_timeframe?(%{description: nil}), do: false

  defp intent_has_timeframe?(%{description: desc}) when is_binary(desc) do
    Enum.any?(@calendar_markers, &String.contains?(desc, &1))
  end

  defp intent_has_timeframe?(_), do: false

  defp intent_priority_boost(%{priority: p}) when is_integer(p) and p >= 4, do: 2
  defp intent_priority_boost(%{priority: p}) when is_integer(p) and p >= 3, do: 1
  defp intent_priority_boost(_), do: 0

  ## Urgent goals

  defp urgent_goals_as_items do
    Goals.list_goals(status: "active")
    |> Enum.filter(&goal_urgent?/1)
    |> Enum.map(fn goal ->
      tf = goal_timeframe_atom(goal.timeframe)

      %{
        kind: :goal,
        source_id: goal.id,
        title: goal.title,
        description: goal.description || "",
        timeframe: tf,
        urgency: timeframe_urgency(tf),
        dedupe_key: "goal:#{goal.id}"
      }
    end)
  end

  # Treat weekly + monthly goals as always-urgent surface candidates.
  # Quarterly/yearly only surface if we're inside the last quarter of their window.
  defp goal_urgent?(%{timeframe: "weekly"}), do: true
  defp goal_urgent?(%{timeframe: "monthly"}), do: true
  defp goal_urgent?(_), do: false

  defp goal_timeframe_atom("weekly"), do: :this_week
  defp goal_timeframe_atom("monthly"), do: :this_month
  defp goal_timeframe_atom("quarterly"), do: :this_quarter
  defp goal_timeframe_atom(_), do: :unspecified

  ## Urgency scoring

  defp timeframe_urgency(:today), do: 10
  defp timeframe_urgency(:this_week), do: 8
  defp timeframe_urgency(:next_week), do: 5
  defp timeframe_urgency(:two_weeks), do: 5
  defp timeframe_urgency(:this_month), do: 4
  defp timeframe_urgency(:this_quarter), do: 3
  defp timeframe_urgency(:next_month), do: 2
  defp timeframe_urgency(:q1), do: 2
  defp timeframe_urgency(:q2), do: 2
  defp timeframe_urgency(:q3), do: 2
  defp timeframe_urgency(:q4), do: 2
  defp timeframe_urgency(_), do: 1

  ## Task surfacing

  defp maybe_create_task(item) do
    if existing_task_for?(item) do
      nil
    else
      attrs = %{
        title: item.title,
        description: build_task_description(item),
        status: "todo",
        priority: urgency_to_priority(item.urgency),
        source_type: @source_type,
        source_id: item.dedupe_key
      }

      case Tasks.create_task(attrs, force_dispatch: false) do
        {:ok, task} ->
          %{
            task_id: task.id,
            source: item.kind,
            source_id: item.source_id,
            timeframe: item.timeframe,
            urgency: item.urgency,
            title: item.title
          }

        {:needs_deliberation, _} ->
          nil

        {:requires_proposal, _} ->
          nil

        {:error, reason} ->
          Logger.warning("CalendarDriver failed to create task: #{inspect(reason)}")
          nil

        _ ->
          nil
      end
    end
  end

  defp existing_task_for?(item) do
    # An open task whose source_id matches our dedupe_key indicates we already
    # surfaced this calendar item.
    open = Tasks.list_tasks(status: "todo") ++ Tasks.list_tasks(status: "in_progress")
    Enum.any?(open, fn t -> Map.get(t, :source_id) == item.dedupe_key end)
  end

  defp build_task_description(item) do
    """
    Surfaced by CalendarDriver from #{item.kind} (#{item.timeframe}).

    #{item.description}
    """
  end

  # Map urgency score to task priority (lower = higher priority).
  defp urgency_to_priority(u) when u >= 9, do: 1
  defp urgency_to_priority(u) when u >= 7, do: 2
  defp urgency_to_priority(u) when u >= 5, do: 3
  defp urgency_to_priority(u) when u >= 3, do: 4
  defp urgency_to_priority(_), do: 5

  ## Read-only summaries

  defp do_next_action do
    items =
      (parse_calendar_items() ++
         timed_intents_as_items() ++
         urgent_goals_as_items())
      |> Enum.sort_by(& &1.urgency, :desc)

    case items do
      [] ->
        {:idle, "No calendar commitments require action right now."}

      [top | _] ->
        reason =
          "#{top.kind} for timeframe #{top.timeframe} (urgency #{top.urgency})"

        {:ok, top.title, reason}
    end
  end

  defp do_progress_summary do
    all_items =
      parse_calendar_items() ++
        timed_intents_as_items() ++
        urgent_goals_as_items()

    timeframes = [:today, :this_week, :next_week, :this_month, :next_month, :this_quarter]

    Enum.into(timeframes, %{}, fn tf ->
      bucket = Enum.filter(all_items, &(&1.timeframe == tf))

      task_states = bucket_task_states(bucket)
      {tf, task_states}
    end)
  end

  defp bucket_task_states(items) do
    keys = items |> Enum.map(& &1.dedupe_key) |> MapSet.new()
    in_progress = Tasks.list_tasks(status: "in_progress")
    completed = Tasks.list_by_status("done")

    in_progress_count = count_matching_keys(in_progress, keys)
    completed_count = count_matching_keys(completed, keys)
    total = length(items)

    %{
      planned: max(total - in_progress_count - completed_count, 0),
      in_progress: in_progress_count,
      completed: completed_count,
      total: total
    }
  end

  defp count_matching_keys(tasks, %MapSet{} = keys) do
    Enum.count(tasks, fn t -> MapSet.member?(keys, Map.get(t, :source_id)) end)
  end

  defp schedule_check, do: Process.send_after(self(), :check, @check_interval)
end
