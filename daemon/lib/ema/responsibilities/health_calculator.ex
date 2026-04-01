defmodule Ema.Responsibilities.HealthCalculator do
  @moduledoc """
  GenServer that recalculates health scores for responsibilities.
  Subscribes to task completion events via PubSub and periodically
  recalculates all active responsibilities.
  """

  use GenServer
  require Logger

  # Recalculate all health scores every 6 hours
  @default_interval :timer.hours(6)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(opts) do
    interval = Keyword.get(opts, :interval, @default_interval)

    Phoenix.PubSub.subscribe(Ema.PubSub, "task_events")

    Process.send_after(self(), :recalculate_all, interval)

    {:ok, %{interval: interval}}
  end

  @impl true
  def handle_info({:task_completed, %{responsibility_id: resp_id}}, state)
      when is_binary(resp_id) do
    recalculate_single(resp_id)
    {:noreply, state}
  end

  @impl true
  def handle_info({:task_completed, _}, state), do: {:noreply, state}

  @impl true
  def handle_info(:recalculate_all, state) do
    Logger.info("[Responsibilities.HealthCalculator] Recalculating all health scores")
    recalculate_all()
    Process.send_after(self(), :recalculate_all, state.interval)
    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp recalculate_single(responsibility_id) do
    case Ema.Responsibilities.get_responsibility(responsibility_id) do
      nil ->
        :ok

      resp ->
        case Ema.Responsibilities.recalculate_health(resp) do
          {:ok, updated} ->
            if updated.health != resp.health do
              broadcast_health_change(updated)
            end

          {:error, reason} ->
            Logger.error("[HealthCalculator] Failed for #{responsibility_id}: #{inspect(reason)}")
        end
    end
  end

  defp recalculate_all do
    Ema.Responsibilities.list_responsibilities(active: true)
    |> Enum.each(fn resp ->
      case Ema.Responsibilities.recalculate_health(resp) do
        {:ok, updated} ->
          if updated.health != resp.health do
            broadcast_health_change(updated)
          end

        {:error, reason} ->
          Logger.error("[HealthCalculator] Failed for #{resp.id}: #{inspect(reason)}")
      end
    end)
  end

  defp broadcast_health_change(resp) do
    EmaWeb.Endpoint.broadcast("responsibilities:lobby", "health_changed", %{
      id: resp.id,
      health: resp.health,
      title: resp.title
    })
  end
end
