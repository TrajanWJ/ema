defmodule Ema.Orchestration.Supervisor do
  @moduledoc """
  Supervisor for orchestration subsystems: fitness tracking, routing, and autotune.
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      Ema.Orchestration.AgentFitnessStore,
      Ema.Orchestration.RoutingEngine,
      Ema.Orchestration.SpecializationAutotune
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end
