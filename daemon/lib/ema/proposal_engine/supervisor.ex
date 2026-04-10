defmodule Ema.ProposalEngine.Supervisor do
  @moduledoc """
  Supervisor for the proposal pipeline.
  Manages scheduler, generator, refiner, debater, tagger, combiner, and kill memory.
  Uses rest_for_one strategy: if a process crashes, all processes started after it restart.

  Batch 3 additions:
    - Ema.Proposals.Orchestrator   — 4-stage pipeline GenServer
    - Ema.Proposals.CostAggregator — Per-proposal cost tracking and budget alerts
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    debater_module =
      case Application.get_env(:ema, :debater_strategy, :classic) do
        :parliament -> Ema.ProposalEngine.ParliamentDebater
        _ -> Ema.ProposalEngine.Debater
      end

    children = [
      {Task.Supervisor, name: Ema.ProposalEngine.TaskSupervisor},
      Ema.ProposalEngine.KillMemory,
      Ema.ProposalEngine.Scorer,
      Ema.ProposalEngine.Tagger,
      debater_module,
      Ema.ProposalEngine.Refiner,
      Ema.ProposalEngine.Generator,
      Ema.ProposalEngine.Combiner,
      Ema.ProposalEngine.SeedQualityScorer,
      Ema.Governance.EpistemicAudit,
      Ema.ProposalEngine.Scheduler,
      # Batch 3: Orchestrator pipeline + cost tracking
      Ema.Proposals.Orchestrator,
      Ema.Proposals.CostAggregator
    ]

    Supervisor.init(children, strategy: :rest_for_one)
  end
end
