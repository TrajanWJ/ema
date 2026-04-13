defmodule Ema.Evolution.Supervisor do
  @moduledoc """
  Supervisor for the evolution engine.
  Manages signal scanner, proposer, and applier.
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      {Task.Supervisor, name: Ema.Evolution.TaskSupervisor},
      Ema.Evolution.SignalScanner,
      Ema.Evolution.Proposer,
      Ema.Evolution.Applier
    ]

    Supervisor.init(children, strategy: :rest_for_one)
  end
end
