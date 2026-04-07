defmodule Ema.IntentionFarmer.BootstrapWatcher do
  @moduledoc """
  Self-healing bootstrap — runs startup bootstrap with retry and periodic rescan.
  Replaces the fire-and-forget `run_async/1` pattern.
  """

  use GenServer
  require Logger

  @initial_delay 4_000
  @rescan_interval :timer.minutes(30)
  @max_retry_delay :timer.minutes(5)
  @max_attempts 6

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def status do
    GenServer.call(__MODULE__, :status)
  end

  @impl true
  def init(_opts) do
    # Skip in MCP stdio mode (same guard as the old maybe_run_startup_bootstrap)
    if System.get_env("EMA_MCP_STDIO") in ["1", "true", "TRUE"] do
      {:ok, %{status: :skipped, attempt: 0, last_result: nil}}
    else
      Process.send_after(self(), :run_bootstrap, @initial_delay)
      {:ok, %{status: :pending, attempt: 0, last_result: nil}}
    end
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply, Map.take(state, [:status, :attempt, :last_result]), state}
  end

  @impl true
  def handle_info(:run_bootstrap, state) do
    case Ema.IntentionFarmer.StartupBootstrap.run() do
      {:ok, payload} ->
        Logger.info("[BootstrapWatcher] Bootstrap succeeded")
        Process.send_after(self(), :rescan, @rescan_interval)
        {:noreply, %{state | status: :ok, attempt: 0, last_result: payload}}

      {:error, reason} ->
        attempt = state.attempt + 1
        Logger.warning("[BootstrapWatcher] Bootstrap failed (attempt #{attempt}): #{reason}")

        if attempt < @max_attempts do
          delay = min((@initial_delay * :math.pow(2, attempt)) |> trunc(), @max_retry_delay)
          Process.send_after(self(), :run_bootstrap, delay)

          {:noreply,
           %{state | status: :retrying, attempt: attempt, last_result: {:error, reason}}}
        else
          Logger.error(
            "[BootstrapWatcher] Bootstrap failed after #{@max_attempts} attempts, giving up"
          )

          Process.send_after(self(), :rescan, @rescan_interval)
          {:noreply, %{state | status: :failed, attempt: attempt, last_result: {:error, reason}}}
        end
    end
  end

  def handle_info(:rescan, state) do
    Logger.debug("[BootstrapWatcher] Periodic rescan")

    case Ema.IntentionFarmer.StartupBootstrap.run() do
      {:ok, payload} ->
        {:noreply, %{state | status: :ok, attempt: 0, last_result: payload}}

      {:error, reason} ->
        Logger.warning("[BootstrapWatcher] Rescan failed: #{reason}")
        {:noreply, %{state | last_result: {:error, reason}}}
    end
    |> then(fn {:noreply, s} ->
      Process.send_after(self(), :rescan, @rescan_interval)
      {:noreply, s}
    end)
  end
end
