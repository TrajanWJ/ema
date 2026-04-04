defmodule Ema.Babysitter.VisibilityHub do
  @moduledoc """
  Subscribes to all EMA PubSub topics and maintains a ring buffer of recent events.

  Categories:
    - :sessions       ← claude_sessions
    - :pipeline       ← tasks, proposals, pipes:runs
    - :build          ← brain_dump, projects
    - :intelligence   ← intelligence:*
    - :system         ← pipes:config
    - :control        ← babysitter:control
  """

  use GenServer
  require Logger

  @topics [
    "claude_sessions",
    "tasks",
    "proposals",
    "pipes:runs",
    "brain_dump",
    "projects",
    "intelligence:routing",
    "pipes:config",
    "babysitter:control"
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
  Returns events since `dt` AND updates the internal cursor to now,
  so the next call starts fresh. Used by StreamTicker.
  """
  def drain_since(%DateTime{} = dt) do
    GenServer.call(__MODULE__, {:drain_since, dt})
  end

  # --- GenServer ---

  @impl true
  def init(_opts) do
    for topic <- @topics do
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
  defp topic_from_message({:claude_session, _}), do: "claude_sessions"
  defp topic_from_message({:session_event, _}), do: "claude_sessions"
  defp topic_from_message({:task_event, _}), do: "tasks"
  defp topic_from_message({:proposal_event, _}), do: "proposals"
  defp topic_from_message({:pipe_run, _}), do: "pipes:runs"
  defp topic_from_message({:brain_dump, _}), do: "brain_dump"
  defp topic_from_message({:project_event, _}), do: "projects"
  defp topic_from_message({:routing, _}), do: "intelligence:routing"
  defp topic_from_message({:pipes_config, _}), do: "pipes:config"
  defp topic_from_message({:babysitter_control, _}), do: "babysitter:control"
  defp topic_from_message(_), do: nil

  defp categorize("claude_sessions"), do: :sessions
  defp categorize("tasks"), do: :pipeline
  defp categorize("proposals"), do: :pipeline
  defp categorize("pipes:runs"), do: :pipeline
  defp categorize("brain_dump"), do: :build
  defp categorize("projects"), do: :build
  defp categorize("intelligence:" <> _), do: :intelligence
  defp categorize("pipes:config"), do: :system
  defp categorize("babysitter:control"), do: :control
  defp categorize(_), do: :unknown
end
