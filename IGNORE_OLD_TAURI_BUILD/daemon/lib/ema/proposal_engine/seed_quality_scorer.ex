defmodule Ema.ProposalEngine.SeedQualityScorer do
  @moduledoc """
  Hourly job that scores proposal seeds by the approval/rejection rate of
  the proposals they have generated.

  Rules (applied per seed once it has produced ≥ 5 proposals):

    * approval rate < 30% → seed is auto-deactivated
    * approval rate > 70% → seed metadata gets a `priority_boost` flag and
      its weight is bumped (capped at 1.0)

  The computed stats are written into `seed.metadata.quality_stats` so the
  scheduler / generator can introspect them later.

  This is the second half of the seed feedback loop — `OutcomeLinker.feed_seed_quality/2`
  scores seeds by execution effectiveness; this scorer scores seeds by user
  approval/kill behaviour on the proposals themselves.
  """

  use GenServer
  require Logger

  import Ecto.Query

  alias Ema.Proposals
  alias Ema.Proposals.Proposal
  alias Ema.Repo

  @interval_ms 60 * 60 * 1000
  @min_proposals 5
  @low_threshold 0.30
  @high_threshold 0.70

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Run the scorer immediately. Useful from tests / IEx."
  def run_now, do: GenServer.cast(__MODULE__, :score)

  @impl true
  def init(_opts) do
    schedule_next()
    Logger.info("[SeedQualityScorer] started — interval: #{div(@interval_ms, 60_000)}m")
    {:ok, %{last_run: nil, last_count: 0}}
  end

  @impl true
  def handle_cast(:score, state) do
    {:noreply, do_score(state)}
  end

  @impl true
  def handle_info(:tick, state) do
    schedule_next()
    {:noreply, do_score(state)}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  defp schedule_next do
    Process.send_after(self(), :tick, @interval_ms)
  end

  defp do_score(state) do
    seeds = Proposals.list_seeds([])
    scored = Enum.map(seeds, &score_seed/1)
    n = Enum.count(scored, &(&1 == :scored))

    Logger.info("[SeedQualityScorer] scored #{n}/#{length(seeds)} seeds")
    %{state | last_run: DateTime.utc_now(), last_count: n}
  rescue
    e ->
      Logger.warning("[SeedQualityScorer] run failed: #{Exception.message(e)}")
      state
  end

  defp score_seed(seed) do
    stats = compute_stats(seed.id)

    if stats.total < @min_proposals do
      :skipped
    else
      apply_decision(seed, stats)
    end
  end

  defp compute_stats(seed_id) do
    rows =
      Proposal
      |> where([p], p.seed_id == ^seed_id)
      |> select([p], {p.status, count(p.id)})
      |> group_by([p], p.status)
      |> Repo.all()
      |> Map.new()

    approved = Map.get(rows, "approved", 0)
    killed = Map.get(rows, "killed", 0)
    redirected = Map.get(rows, "redirected", 0)
    queued = Map.get(rows, "queued", 0)
    reviewing = Map.get(rows, "reviewing", 0)
    failed = Map.get(rows, "failed", 0)

    decided = approved + killed + redirected
    total = decided + queued + reviewing + failed

    approval_rate =
      if decided > 0 do
        approved / decided
      else
        0.0
      end

    %{
      total: total,
      decided: decided,
      approved: approved,
      killed: killed,
      redirected: redirected,
      queued: queued,
      failed: failed,
      approval_rate: Float.round(approval_rate, 3)
    }
  end

  defp apply_decision(seed, stats) do
    metadata = seed.metadata || %{}

    new_meta =
      Map.merge(metadata, %{
        "quality_stats" => stats,
        "quality_scored_at" => DateTime.utc_now() |> DateTime.to_iso8601()
      })

    attrs = %{metadata: new_meta}

    attrs =
      cond do
        stats.decided >= @min_proposals and stats.approval_rate < @low_threshold ->
          Logger.info(
            "[SeedQualityScorer] Deactivating seed #{seed.id} (#{seed.name}) — approval=#{stats.approval_rate}"
          )

          new_meta =
            Map.put(
              new_meta,
              "deactivation_reason",
              "approval_rate < #{@low_threshold} after #{stats.decided} proposals"
            )

          %{attrs | metadata: new_meta}
          |> Map.put(:active, false)

        stats.decided >= @min_proposals and stats.approval_rate > @high_threshold ->
          Logger.info(
            "[SeedQualityScorer] Boosting seed #{seed.id} (#{seed.name}) — approval=#{stats.approval_rate}"
          )

          new_meta = Map.put(new_meta, "priority_boost", true)
          %{attrs | metadata: new_meta}

        true ->
          attrs
      end

    case Proposals.update_seed(seed, attrs) do
      {:ok, _} -> :scored
      {:error, reason} ->
        Logger.warning("[SeedQualityScorer] update failed for #{seed.id}: #{inspect(reason)}")
        :error
    end
  end
end
