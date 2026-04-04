defmodule Ema.Feedback.Consumer do
  @moduledoc """
  Subscribes to "ema:feedback" PubSub and writes all events to:
    1. Ema.Feedback.Store — in-memory ring buffer (last 500 events, queryable via API)
    2. "ema:hq:feedback" — Phoenix channel topic for LiveView / HQ dashboard real-time push
    3. Logging (debug level, structured)

  This is the EMA-side visibility layer — everything Discord sees, EMA sees too.
  The HQ dashboard subscribes to "ema:hq:feedback" via Phoenix Channels or PubSub.
  """

  use GenServer
  require Logger

  alias Ema.Feedback.Store

  @pubsub Ema.PubSub
  @feedback_topic "ema:feedback"
  @hq_topic "ema:hq:feedback"

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def status do
    GenServer.call(__MODULE__, :status)
  catch
    :exit, _ -> %{running: false}
  end

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(@pubsub, @feedback_topic)
    Store.init()
    Logger.info("[Feedback.Consumer] Started — subscribed to #{@feedback_topic}")
    {:ok, %{received: 0, last_at: nil}}
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply, %{
      running: true,
      received: state.received,
      last_at: state.last_at,
      store_size: Store.size()
    }, state}
  end

  @impl true
  def handle_info({:feedback, event}, state) do
    # 1. Store in ring buffer
    Store.push(event)

    # 2. Re-broadcast to HQ dashboard topic
    Phoenix.PubSub.broadcast(@pubsub, @hq_topic, {:hq_feedback, event})

    # 3. Structured log
    Logger.debug("[Feedback] #{event.source} → ch:#{event.channel_id || "internal"} | #{truncate(event.message, 80)}")

    {:noreply, %{state | received: state.received + 1, last_at: event.timestamp}}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  defp truncate(s, max) when byte_size(s) > max, do: String.slice(s, 0, max) <> "…"
  defp truncate(s, _), do: s
end


defmodule Ema.Feedback.Store do
  @moduledoc """
  In-memory ring buffer for feedback events. Holds last 500 events.
  Backed by :persistent_term for fast reads, GenServer for writes.
  """

  @max_size 500
  @key :ema_feedback_store

  def init do
    unless :persistent_term.get(@key, nil) do
      :persistent_term.put(@key, :queue.new())
    end
  end

  def push(event) do
    q = :persistent_term.get(@key, :queue.new())
    q2 = :queue.in(event, q)
    q3 = if :queue.len(q2) > @max_size do
      {_, q_trimmed} = :queue.out(q2)
      q_trimmed
    else
      q2
    end
    :persistent_term.put(@key, q3)
  end

  def recent(n \\ 50) do
    q = :persistent_term.get(@key, :queue.new())
    :queue.to_list(q) |> Enum.take(-n)
  end

  def size do
    :persistent_term.get(@key, :queue.new()) |> :queue.len()
  end

  def all do
    :persistent_term.get(@key, :queue.new()) |> :queue.to_list()
  end
end
