defmodule Ema.Harvesters.BrainDumpHarvester do
  @moduledoc """
  BrainDumpHarvester — scans unprocessed brain dump items and creates
  proposal seeds for items that have aged past the threshold.

  Stub implementation for Week 7. Full triage logic in Week 8.
  """

  use Ema.Harvesters.Base, name: "brain_dump", interval: :timer.hours(2)

  require Logger

  @impl Ema.Harvesters.Base
  def harvester_name, do: "brain_dump"

  @impl Ema.Harvesters.Base
  def default_interval, do: :timer.hours(2)

  @impl Ema.Harvesters.Base
  def harvest(_context) do
    # Week 7 stub — full brain dump triage deferred to Week 8
    Logger.debug("[BrainDumpHarvester] Brain dump triage deferred to Week 8 — stub run complete")
    {:ok, %{items_found: 0, seeds_created: 0, metadata: %{stub: true}}}
  end
end
