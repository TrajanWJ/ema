defmodule Ema.ProposalEngine.Supervisor do
  @moduledoc """
  Supervisor for the proposal pipeline.
  Manages scheduler, generator, refiner, debater, tagger, combiner, and kill memory.
  Uses rest_for_one strategy: if a process crashes, all processes started after it restart.
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      Ema.ProposalEngine.KillMemory,
      Ema.ProposalEngine.Tagger,
      Ema.ProposalEngine.Debater,
      Ema.ProposalEngine.Refiner,
      Ema.ProposalEngine.Generator,
      Ema.ProposalEngine.Combiner,
      Ema.ProposalEngine.Scheduler
    ]

    Supervisor.init(children, strategy: :rest_for_one)
  end
end
