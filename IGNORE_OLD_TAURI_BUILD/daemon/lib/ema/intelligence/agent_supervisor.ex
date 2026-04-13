defmodule Ema.Intelligence.AgentSupervisor do
  @moduledoc """
  Supervision tree for the Intelligence Layer agent integration subsystems.

  Starts the signal processing and outcome tracking subsystems that form
  the foundation of EMA's self-improving agent integration layer.
  Full routing is handled by Ema.Intelligence.Router (separate process).
  """

  use Supervisor
  require Logger

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    Logger.info("[Intelligence.AgentSupervisor] starting intelligence layer stubs")

    children = [
      Ema.Intelligence.SignalProcessor,
      Ema.Intelligence.OutcomeTracker
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end
