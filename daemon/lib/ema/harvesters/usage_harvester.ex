defmodule Ema.Harvesters.UsageHarvester do
  @moduledoc """
  UsageHarvester — aggregates token usage and cost records to surface
  high-cost sessions or agent patterns worth reviewing.

  Stub implementation for Week 7. Full analysis in Week 8.
  """

  use Ema.Harvesters.Base, name: "usage", interval: :timer.hours(6)

  require Logger

  @impl Ema.Harvesters.Base
  def harvester_name, do: "usage"

  @impl Ema.Harvesters.Base
  def default_interval, do: :timer.hours(6)

  @impl Ema.Harvesters.Base
  def harvest(_context) do
    # Week 7 stub — logs that usage analysis deferred to Week 8
    Logger.debug("[UsageHarvester] Usage aggregation deferred to Week 8 — stub run complete")
    {:ok, %{items_found: 0, seeds_created: 0, metadata: %{stub: true}}}
  end
end
