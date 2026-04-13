defmodule Ema.Governance.EpistemicAudit do
  @moduledoc """
  Weekly calibration audit. For every agent that produced proposals or
  executions in the last 7 days, compares the agent's claimed confidence
  against the actual outcomes:

    * For proposals: `proposal.confidence` vs the effectiveness classification
      of the linked execution (via `OutcomeLinker.summarize/2`).
    * For executions: agent fitness `success_rate` is treated as the empirical
      ground-truth, and we compare it to the average claimed confidence on
      the proposals that produced those executions.

  Output is written as a `guideline` Memory entry per agent (so the lesson
  is injected back into future prompts) plus an aggregate report entry.
  Findings persist in `~/.local/share/ema/audits/epistemic-YYYY-MM-DD.json`.

  Calibration metric: `calibration = avg_confidence - empirical_success_rate`.
    *  > 0.15  → overconfident
    *  < -0.15 → underconfident
    *  else    → calibrated
  """

  use GenServer
  require Logger
  import Ecto.Query

  alias Ema.Orchestration.AgentFitnessStore
  alias Ema.ProposalEngine.OutcomeLinker
  alias Ema.Proposals.Proposal
  alias Ema.Repo

  @interval_ms 7 * 24 * 60 * 60 * 1000
  @overconfident 0.15
  @underconfident -0.15
  @lookback_days 7

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Run the audit immediately and return the report."
  def run_now, do: GenServer.call(__MODULE__, :run, 60_000)

  @impl true
  def init(_opts) do
    schedule_next()
    Logger.info("[EpistemicAudit] started — interval: 7d")
    {:ok, %{last_run: nil}}
  end

  @impl true
  def handle_call(:run, _from, state) do
    {report, state2} = do_run(state)
    {:reply, {:ok, report}, state2}
  end

  @impl true
  def handle_info(:tick, state) do
    schedule_next()
    {_report, state2} = do_run(state)
    {:noreply, state2}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  defp schedule_next, do: Process.send_after(self(), :tick, @interval_ms)

  defp do_run(state) do
    cutoff = DateTime.utc_now() |> DateTime.add(-@lookback_days * 86_400, :second)

    proposals =
      Proposal
      |> where([p], p.inserted_at >= ^cutoff)
      |> where([p], not is_nil(p.confidence))
      |> Repo.all()

    grouped = Enum.group_by(proposals, &agent_key_for/1)

    findings =
      Enum.map(grouped, fn {agent, props} ->
        analyze_agent(agent, props)
      end)
      |> Enum.reject(&is_nil/1)

    Enum.each(findings, &store_finding/1)
    write_report(findings)
    Logger.info("[EpistemicAudit] complete — #{length(findings)} agents audited")

    {findings, %{state | last_run: DateTime.utc_now()}}
  rescue
    e ->
      Logger.warning("[EpistemicAudit] run failed: #{Exception.message(e)}")
      {[], state}
  end

  defp agent_key_for(%Proposal{actor_id: nil}), do: "unknown"
  defp agent_key_for(%Proposal{actor_id: id}), do: id

  defp analyze_agent(agent, proposals) when length(proposals) < 3, do:
    %{agent: agent, proposals: length(proposals), status: "insufficient_data"}

  defp analyze_agent(agent, proposals) do
    confidences = proposals |> Enum.map(& &1.confidence) |> Enum.reject(&is_nil/1)
    avg_confidence = avg(confidences)

    {empirical, sample_size} = empirical_success_rate(agent, proposals)
    calibration = avg_confidence - empirical
    status = classify(calibration)

    %{
      agent: agent,
      proposals: length(proposals),
      avg_confidence: Float.round(avg_confidence, 3),
      empirical_success_rate: Float.round(empirical, 3),
      calibration: Float.round(calibration, 3),
      sample_size: sample_size,
      status: status,
      generated_at: DateTime.utc_now()
    }
  end

  defp empirical_success_rate(agent, proposals) do
    {effective, scored} =
      proposals
      |> Enum.reduce({0, 0}, fn proposal, {hits, total} ->
        execution = Ema.Executions.get_by_proposal(proposal.id)
        summary = OutcomeLinker.summarize(proposal, execution)

        case summary.effectiveness do
          "effective" -> {hits + 1, total + 1}
          "mixed" -> {hits + 0, total + 1}
          "ineffective" -> {hits + 0, total + 1}
          _ -> {hits, total}
        end
      end)

    rate =
      if scored > 0 do
        effective / scored
      else
        # Fall back to AgentFitnessStore if no executions are linked yet
        case AgentFitnessStore.get_fitness(agent) do
          {:ok, fitness} -> fitness.success_rate
        end
      end

    {rate, scored}
  end

  defp classify(calibration) when calibration > @overconfident, do: "overconfident"
  defp classify(calibration) when calibration < @underconfident, do: "underconfident"
  defp classify(_), do: "calibrated"

  defp store_finding(%{status: "insufficient_data"}), do: :ok

  defp store_finding(finding) do
    content =
      """
      [CALIBRATION] agent=#{finding.agent} status=#{finding.status}
      proposals_audited: #{finding.proposals}
      avg_claimed_confidence: #{finding.avg_confidence}
      empirical_success_rate: #{finding.empirical_success_rate}
      calibration_gap: #{finding.calibration}

      #{calibration_advice(finding.status, finding.calibration)}
      """
      |> String.trim()

    attrs = %{
      memory_type: "guideline",
      scope: "global",
      content: content,
      importance: importance_for(finding.status),
      metadata: %{
        "agent_id" => finding.agent,
        "kind" => "epistemic_audit",
        "calibration" => finding.calibration,
        "status" => finding.status
      }
    }

    case Ema.Memory.store_entry(attrs) do
      {:ok, _} -> :ok
      {:error, reason} ->
        Logger.debug("[EpistemicAudit] Memory.store_entry failed: #{inspect(reason)}")
    end
  end

  defp calibration_advice("overconfident", _),
    do: "Lower confidence on future proposals — claimed certainty exceeds observed effectiveness."

  defp calibration_advice("underconfident", _),
    do: "Raise confidence on future proposals — observed effectiveness exceeds claimed certainty."

  defp calibration_advice(_, _), do: "Calibration within tolerance — keep current confidence priors."

  defp importance_for("overconfident"), do: 0.8
  defp importance_for("underconfident"), do: 0.6
  defp importance_for(_), do: 0.4

  defp write_report(findings) do
    dir = Path.join(Ema.Config.data_dir(), "audits")
    File.mkdir_p(dir)
    date = Date.utc_today() |> Date.to_iso8601()
    path = Path.join(dir, "epistemic-#{date}.json")

    payload = %{
      generated_at: DateTime.utc_now() |> DateTime.to_iso8601(),
      lookback_days: @lookback_days,
      findings: findings
    }

    case Jason.encode(payload, pretty: true) do
      {:ok, json} ->
        File.write(path, json)

      {:error, reason} ->
        Logger.debug("[EpistemicAudit] encode failed: #{inspect(reason)}")
    end
  rescue
    e -> Logger.debug("[EpistemicAudit] write_report crashed: #{Exception.message(e)}")
  end

  defp avg([]), do: 0.0
  defp avg(list), do: Enum.sum(list) / length(list)
end
