defmodule Ema.Intelligence.GapScanner do
  @moduledoc """
  GenServer that periodically scans for gaps from all sources.
  """

  use GenServer
  require Logger

  @scan_interval :timer.minutes(60)

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  @impl true
  def init(state) do
    # Initial scan after 30s to let system boot
    Process.send_after(self(), :scan, :timer.seconds(30))
    {:ok, state}
  end

  @impl true
  def handle_info(:scan, state) do
    Logger.info("GapScanner: running periodic scan")

    case Ema.Intelligence.GapInbox.scan_all() do
      :ok ->
        counts = Ema.Intelligence.GapInbox.gap_counts()
        EmaWeb.Endpoint.broadcast("gaps:live", "scan_complete", %{counts: counts})

      error ->
        Logger.warning("GapScanner: scan failed: #{inspect(error)}")
    end

    schedule_scan()
    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp schedule_scan do
    Process.send_after(self(), :scan, @scan_interval)
  end
end
