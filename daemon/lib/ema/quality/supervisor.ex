defmodule Ema.Quality.Supervisor do
  @moduledoc """
  Supervisor for all quality monitoring subsystems.
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      Ema.Quality.BudgetLedger,
      Ema.Quality.FrictionDetector,
      Ema.Quality.AutonomousImprovementEngine,
      Ema.Quality.ThreatModelAutomaton
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end
