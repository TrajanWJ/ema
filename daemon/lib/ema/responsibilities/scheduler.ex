defmodule Ema.Responsibilities.Scheduler do
  @moduledoc """
  GenServer that runs daily to generate tasks for responsibilities whose cadence is due.
  """

  use GenServer
  require Logger

  # Run once per day (24 hours in milliseconds)
  @default_interval :timer.hours(24)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(opts) do
    interval = Keyword.get(opts, :interval, @default_interval)

    # Schedule first run after a short delay to let the app fully start
    Process.send_after(self(), :generate, :timer.seconds(30))

    {:ok, %{interval: interval}}
  end

  @impl true
  def handle_info(:generate, state) do
    Logger.info("[Responsibilities.Scheduler] Running generate_due_tasks")

    case safe_generate() do
      {:ok, count} ->
        Logger.info("[Responsibilities.Scheduler] Generated #{count} tasks")

      {:error, reason} ->
        Logger.error("[Responsibilities.Scheduler] Failed: #{inspect(reason)}")
    end

    Process.send_after(self(), :generate, state.interval)
    {:noreply, state}
  end

  defp safe_generate do
    results = Ema.Responsibilities.generate_due_tasks()
    successes = Enum.count(results, &match?({:ok, _}, &1))
    {:ok, successes}
  rescue
    e -> {:error, e}
  end
end
