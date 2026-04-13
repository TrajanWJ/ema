defmodule Ema.Babysitter.VisibilityHub do
  @moduledoc """
  Subscribes to EMA PubSub topics and maintains a ring buffer of recent events.

  Active categories:
    - :build          ← brain_dump
    - :pipeline       ← executions, task_events, goals
    - :system         ← pipes:config

  Planned (not yet wired — see TODO in @active_topics):
    - :sessions       ← claude_sessions
    - :intelligence   ← intelligence:routing
    - :control        ← babysitter:control
  """

  use GenServer
  require Logger

  @active_topics [
    "brain_dump",
    "executions",
    "task_events",
    "goals",
    "pipes:config",
    "claude_sessions",
    "proposals:events",
    "pipes:runs",
    "projects",
    "intents",
    "system:alerts",
    "loops:lobby",
    "intelligence:outcomes"
  ]

  @default_buffer_size 100

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "All buffered events (newest last)."
  def all_events do
    GenServer.call(__MODULE__, :all_events)
  end

  @doc "Events recorded at or after `dt`."
  def events_since(%DateTime{} = dt) do
    GenServer.call(__MODULE__, {:events_since, dt})
  end

  @doc "Events for a specific category atom."
  def events_by_category(category) when is_atom(category) do
    GenServer.call(__MODULE__, {:events_by_category, category})
  end

  @doc """
  Returns events recorded at or after `dt`.

  This is a pure query. Callers track their own cursor or last-seen time.
  """
  def drain_since(%DateTime{} = dt) do
    GenServer.call(__MODULE__, {:drain_since, dt})
  end

  # --- GenServer ---

  @impl true
  def init(_opts) do
    for topic <- @active_topics do
      Phoenix.PubSub.subscribe(Ema.PubSub, topic)
    end

    buffer_size = @default_buffer_size
    state = %{events: :queue.new(), count: 0, max: buffer_size}
    {:ok, state}
  end

  @impl true
  def handle_call(:all_events, _from, state) do
    {:reply, :queue.to_list(state.events), state}
  end

  def handle_call({:events_since, dt}, _from, state) do
    result =
      state.events
      |> :queue.to_list()
      |> Enum.filter(fn e -> DateTime.compare(e.at, dt) in [:gt, :eq] end)

    {:reply, result, state}
  end

  def handle_call({:events_by_category, category}, _from, state) do
    result =
      state.events
      |> :queue.to_list()
      |> Enum.filter(fn e -> e.category == category end)

    {:reply, result, state}
  end

  def handle_call({:drain_since, dt}, _from, state) do
    result =
      state.events
      |> :queue.to_list()
      |> Enum.filter(fn e -> DateTime.compare(e.at, dt) in [:gt, :eq] end)

    {:reply, result, state}
  end

  @impl true
  def handle_info(msg, state) do
    # Determine which topic triggered this — Phoenix.PubSub delivers as the raw message
    # We intercept by matching the process mailbox metadata
    topic = topic_from_message(msg)
    category = categorize(topic)

    event = %{
      category: category,
      topic: topic || "unknown",
      event: msg,
      at: DateTime.utc_now()
    }

    new_state = push_event(state, event)
    {:noreply, new_state}
  end

  # --- Helpers ---

  defp push_event(%{events: q, count: n, max: max} = state, event) do
    {q2, n2} =
      if n >= max do
        {:queue.drop(q), n - 1}
      else
        {q, n}
      end

    %{state | events: :queue.in(event, q2), count: n2 + 1}
  end

  # Try to infer topic from message shape — PubSub delivers raw messages,
  # but we subscribed per-topic so we tag on receipt via process dict trick.
  # Since Elixir's PubSub doesn't include topic in the message itself,
  # we use a metadata wrapper approach: store the topic when subscribing
  # and match known message shapes.
  # brain_dump broadcasts {:brain_dump, :item_created, item}
  defp topic_from_message({:brain_dump, _, _}), do: "brain_dump"
  # executions broadcasts {"execution:*", payload}
  defp topic_from_message({"execution:" <> _, _}), do: "executions"
  # task_events broadcasts {:task_completed, payload}
  defp topic_from_message({:task_completed, _}), do: "task_events"
  # goals broadcasts {:goals, :created, goal}
  defp topic_from_message({:goals, _, _}), do: "goals"
  # pipes:config broadcasts :pipes_changed atom
  defp topic_from_message(:pipes_changed), do: "pipes:config"
  defp topic_from_message({:projects, _, _}), do: "projects"
  defp topic_from_message({"proposal_" <> _, _}), do: "proposals:events"
  defp topic_from_message({:pipe_run, _, _}), do: "pipes:runs"
  defp topic_from_message({:session_detected, _}), do: "claude_sessions"
  defp topic_from_message({:session_imported, _}), do: "claude_sessions"
  defp topic_from_message({:intents, _, _}), do: "intents"
  defp topic_from_message({:cost_tier_changed, _}), do: "system:alerts"
  defp topic_from_message({:loop_opened, _}), do: "loops:lobby"
  defp topic_from_message({:loop_touched, _}), do: "loops:lobby"
  defp topic_from_message({:loop_closed, _}), do: "loops:lobby"
  defp topic_from_message({:loop_escalated, _}), do: "loops:lobby"
  defp topic_from_message({:outcome_logged, _}), do: "intelligence:outcomes"
  defp topic_from_message(_), do: nil

  defp categorize("brain_dump"), do: :build
  defp categorize("executions"), do: :pipeline
  defp categorize("task_events"), do: :pipeline
  defp categorize("goals"), do: :pipeline
  defp categorize("pipes:config"), do: :system
  defp categorize("proposals:events"), do: :pipeline
  defp categorize("projects"), do: :build
  defp categorize("pipes:runs"), do: :system
  defp categorize("claude_sessions"), do: :sessions
  defp categorize("intents"), do: :pipeline
  defp categorize("system:alerts"), do: :system
  defp categorize("loops:lobby"), do: :pipeline
  defp categorize("intelligence:outcomes"), do: :intelligence
  defp categorize(_), do: :unknown
end
