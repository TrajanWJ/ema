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
  9. NodeCoordinator — distributed node discovery (when :distributed_ai enabled)
  10. SyncCoordinator — CRDT state sync across nodes (when :distributed_ai enabled)

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

    base_children = [
      # Layer 1: Provider and account state
      Ema.Claude.ProviderRegistry,
      Ema.Claude.AccountManager,

      # Layer 2: Legacy backend + safety infrastructure
      Ema.Claude.Backend,
      Ema.Claude.CircuitBreaker,
      Ema.Claude.CostTracker,

      # Layer 3: Routing engine
      Ema.Claude.SmartRouter

      # Layer 4: Bridge processes spawned dynamically by SmartRouter
      # Ema.Claude.Bridge is NOT a singleton — started per-execution
    ]

    distributed_children =
      if distributed_ai_enabled?() do
        Logger.info("[Claude.BridgeSupervisor] Starting distributed AI layer")

        [
          Ema.Claude.NodeCoordinator,
          Ema.Claude.SyncCoordinator
        ]
      else
        []
      end

    children = base_children ++ distributed_children

    Logger.info("[Claude.BridgeSupervisor] Starting #{length(children)} child processes")

    Supervisor.init(children, strategy: :rest_for_one)
  end

  defp distributed_ai_enabled? do
    Application.get_env(:ema, :distributed_ai, [])
    |> Keyword.get(:enabled, false)
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
