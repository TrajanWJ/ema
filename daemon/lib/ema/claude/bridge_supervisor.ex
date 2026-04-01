defmodule Ema.Claude.BridgeSupervisor do
  @moduledoc """
  Supervises all Claude multi-backend processes.

  Starts processes in dependency order:
  1. Config validation (synchronous, before anything else)
  2. ProviderRegistry — manages available providers
  3. AccountManager — manages accounts per provider
  4. Backend — legacy dual-backend switcher (backward compat)
  5. CircuitBreaker — failure tracking
  6. CostTracker — token/cost tracking
  7. SmartRouter — intelligent routing engine
  8. Bridge — main entry point, uses SmartRouter

  Uses `:rest_for_one` — if ProviderRegistry crashes, everything
  downstream (AccountManager, SmartRouter, Bridge) restarts too.
  """

  use Supervisor

  require Logger

  def start_link(init_arg) do
    Supervisor.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  @impl true
  def init(_init_arg) do
    validate_config()

    children = [
      # Layer 1: Provider and account state
      Ema.Claude.ProviderRegistry,
      Ema.Claude.AccountManager,

      # Layer 2: Legacy backend + safety infrastructure
      Ema.Claude.Backend,
      Ema.Claude.CircuitBreaker,
      Ema.Claude.CostTracker,

      # Layer 3: Routing engine
      Ema.Claude.SmartRouter,

      # Layer 4: Main bridge (depends on everything above)
      Ema.Claude.Bridge
    ]

    Logger.info("[Claude.BridgeSupervisor] Starting #{length(children)} child processes")

    Supervisor.init(children, strategy: :rest_for_one)
  end

  defp validate_config do
    case Ema.Claude.Config.validate() do
      {:ok, _warnings} ->
        :ok

      {:error, errors} ->
        Logger.error("[Claude.Supervisor] Config validation failed: #{inspect(errors)}")
        # Don't crash — start with defaults and let individual processes handle missing config
        :ok
    end
  end
end
