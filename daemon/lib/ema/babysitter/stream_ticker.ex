defmodule Ema.Babysitter.StreamTicker do
  @moduledoc """
  Periodic ticker that drains VisibilityHub events and posts a formatted
  stream-of-consciousness summary to the Babysitter Discord channel.
  """

  use GenServer
  require Logger

  @channel_id "1489815817867624578"
  @default_interval_ms 15_000
  @setting_key "babysitter.tick_interval_ms"

  # Category display labels (order matters for output)
  @category_labels [
    {:sessions, "🤖 Sessions"},
    {:pipeline, "⚙️ Pipeline"},
    {:build, "🏗️ Build"},
    {:intelligence, "🧠 Intelligence"},
    {:system, "🔧 System"},
    {:control, "🎛️ Control"},
    {:unknown, "❓ Other"}
  ]

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Trigger an immediate tick."
  def tick_now do
    GenServer.cast(__MODULE__, :tick_now)
  end

  @doc "Update tick interval in ms. Persists to Settings."
  def set_interval(ms) when is_integer(ms) and ms > 0 do
    GenServer.call(__MODULE__, {:set_interval, ms})
  end

  @doc "Return current config."
  def config do
    GenServer.call(__MODULE__, :config)
  end

  # --- GenServer ---

  @impl true
  def init(_opts) do
    interval = read_interval()
    timer = schedule_tick(interval)
    now = DateTime.utc_now()

    state = %{
      interval_ms: interval,
      timer: timer,
      last_tick_at: now
    }

    {:ok, state}
  end

  @impl true
  def handle_call({:set_interval, ms}, _from, state) do
    Ema.Settings.set(@setting_key, to_string(ms))
    if state.timer, do: Process.cancel_timer(state.timer)
    timer = schedule_tick(ms)
    {:reply, :ok, %{state | interval_ms: ms, timer: timer}}
  end

  def handle_call(:config, _from, state) do
    {:reply, %{interval_ms: state.interval_ms, last_tick_at: state.last_tick_at}, state}
  end

  @impl true
  def handle_cast(:tick_now, state) do
    new_state = do_tick(state)
    {:noreply, new_state}
  end

  @impl true
  def handle_info(:tick, state) do
    new_state = do_tick(state)
    timer = schedule_tick(new_state.interval_ms)
    {:noreply, %{new_state | timer: timer}}
  end

  # --- Internal ---

  defp do_tick(state) do
    events = Ema.Babysitter.VisibilityHub.drain_since(state.last_tick_at)
    now = DateTime.utc_now()

    if events != [] do
      message = format_message(events, state.last_tick_at, now)
      post_to_discord(message)
    end

    %{state | last_tick_at: now}
  end

  defp format_message(events, from_dt, to_dt) do
    by_category = Enum.group_by(events, & &1.category)

    sections =
      @category_labels
      |> Enum.filter(fn {cat, _label} -> Map.has_key?(by_category, cat) end)
      |> Enum.map(fn {cat, label} ->
        items = Map.fetch!(by_category, cat)
        bullets = Enum.map(items, fn e -> "• #{format_event(e)}" end)
        "**#{label}**\n" <> Enum.join(bullets, "\n")
      end)

    from_str = Calendar.strftime(from_dt, "%H:%M:%S")
    to_str = Calendar.strftime(to_dt, "%H:%M:%S")

    footer = "-# 🕐 #{from_str} → #{to_str} UTC | #{length(events)} event(s)"

    Enum.join(sections, "\n\n") <> "\n\n" <> footer
  end

  defp format_event(%{topic: topic, event: event}) do
    case event do
      {_tag, payload} when is_map(payload) ->
        summary = Map.get(payload, :summary) || Map.get(payload, :message) || Map.get(payload, :name) || inspect(payload, limit: 3)
        "`#{topic}` #{summary}"

      {_tag, payload} when is_binary(payload) ->
        "`#{topic}` #{payload}"

      _ ->
        "`#{topic}` #{inspect(event, limit: 3)}"
    end
  end

  defp post_to_discord(message) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "discord:outbound:#{@channel_id}",
      {:post, message}
    )
  end

  defp schedule_tick(interval_ms) do
    Process.send_after(self(), :tick, interval_ms)
  end

  defp read_interval do
    case Ema.Settings.get(@setting_key) do
      nil -> @default_interval_ms
      val when is_binary(val) -> String.to_integer(val)
      val when is_integer(val) -> val
    end
  end
end
