defmodule Ema.Canvas.DataRefresher do
  @moduledoc """
  GenServer that tracks canvas elements with refresh_interval set,
  periodically fetches fresh data via DataSource, and broadcasts
  updates via PubSub.
  """

  use GenServer

  alias Ema.Canvas.DataSource

  @tick_interval :timer.seconds(10)

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def track_element(element_id, data_source, data_config, refresh_interval) do
    GenServer.cast(__MODULE__, {:track, element_id, data_source, data_config, refresh_interval})
  end

  def untrack_element(element_id) do
    GenServer.cast(__MODULE__, {:untrack, element_id})
  end

  def tracked_elements do
    GenServer.call(__MODULE__, :tracked)
  end

  # --- Server Callbacks ---

  @impl true
  def init(_opts) do
    schedule_tick()
    {:ok, %{elements: %{}}}
  end

  @impl true
  def handle_cast({:track, element_id, data_source, data_config, refresh_interval}, state) do
    entry = %{
      data_source: data_source,
      data_config: data_config || %{},
      refresh_interval: refresh_interval,
      last_refreshed_at: nil
    }

    {:noreply, put_in(state, [:elements, element_id], entry)}
  end

  @impl true
  def handle_cast({:untrack, element_id}, state) do
    {:noreply, update_in(state, [:elements], &Map.delete(&1, element_id))}
  end

  @impl true
  def handle_call(:tracked, _from, state) do
    {:reply, state.elements, state}
  end

  @impl true
  def handle_info(:tick, state) do
    now = System.monotonic_time(:second)
    new_elements = refresh_due_elements(state.elements, now)
    schedule_tick()
    {:noreply, %{state | elements: new_elements}}
  end

  defp refresh_due_elements(elements, now) do
    Enum.reduce(elements, elements, fn {element_id, entry}, acc ->
      due? =
        is_nil(entry.last_refreshed_at) or
          now - entry.last_refreshed_at >= entry.refresh_interval

      if due? do
        case DataSource.fetch(entry.data_source, entry.data_config) do
          {:ok, data} ->
            Phoenix.PubSub.broadcast(
              Ema.PubSub,
              "canvas:data:#{element_id}",
              {:data_refresh, element_id, data}
            )

          {:error, _reason} ->
            :ok
        end

        Map.put(acc, element_id, %{entry | last_refreshed_at: now})
      else
        acc
      end
    end)
  end

  defp schedule_tick do
    Process.send_after(self(), :tick, @tick_interval)
  end
end
