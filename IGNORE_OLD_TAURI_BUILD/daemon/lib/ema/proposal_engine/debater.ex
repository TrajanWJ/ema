defmodule Ema.ProposalEngine.Debater do
  @moduledoc """
  Subscribes to {:proposals, :refined} via PubSub.
  Runs steelman/red-team/synthesis debate on proposals.
  Sets the confidence score and publishes {:proposals, :debated}.
  """

  use GenServer

  require Logger

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "proposals:pipeline")
    {:ok, %{}}
  end

  @impl true
  def handle_info({:proposals, :refined, proposal}, state) do
    Task.Supervisor.start_child(Ema.ProposalEngine.TaskSupervisor, fn ->
      case Application.get_env(:ema, :debater_strategy, :classic) do
        :parliament -> do_parliament(proposal)
        _ -> do_debate(proposal)
      end
    end)

    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # ── Parliament strategy (OpenKoi pattern) ─────────────────────────────────
  # Five perspectives in one LLM call. Sets confidence + writes the synthesis
  # into the proposal's `synthesis` field, plus a `parliament` blob into
  # `generation_log` so the full deliberation is inspectable.
  defp do_parliament(proposal) do
    case Ema.ProposalEngine.Parliament.deliberate(proposal) do
      {:ok, deliberation} ->
        gen_log = proposal.generation_log || %{}
        updated_log = Map.put(gen_log, "parliament", parliament_to_log(deliberation))

        attrs = %{
          synthesis: deliberation.synthesis,
          confidence: deliberation.confidence,
          generation_log: updated_log
        }

        case Ema.Proposals.update_proposal(proposal, attrs) do
          {:ok, updated} ->
            Logger.info(
              "Debater(parliament): proposal #{updated.id} confidence=#{updated.confidence} any_reject=#{deliberation.any_reject}"
            )

            Phoenix.PubSub.broadcast(
              Ema.PubSub,
              "proposals:pipeline",
              {:proposals, :debated, updated}
            )

          {:error, reason} ->
            Logger.error("Debater(parliament): failed to update proposal: #{inspect(reason)}")
        end

      {:error, reason} ->
        Logger.warning(
          "Debater(parliament): failed for proposal #{proposal.id}: #{inspect(reason)}"
        )

        Phoenix.PubSub.broadcast(
          Ema.PubSub,
          "proposals:pipeline",
          {:proposals, :debated, proposal}
        )
    end
  end

  defp parliament_to_log(d) do
    %{
      "guardian" => agency_to_map(d.guardian),
      "economist" => agency_to_map(d.economist),
      "empath" => agency_to_map(d.empath),
      "scholar" => agency_to_map(d.scholar),
      "strategist" => agency_to_map(d.strategist),
      "synthesis" => d.synthesis,
      "confidence" => d.confidence,
      "any_reject" => d.any_reject
    }
  end

  defp agency_to_map(%{verdict: v, reasoning: r}),
    do: %{"verdict" => Atom.to_string(v), "reasoning" => r}

  defp agency_to_map(_), do: %{"verdict" => "unknown", "reasoning" => ""}

  defp do_debate(proposal) do
    prompt = """
    Here is a proposal and its critique. Run an internal debate.

    Title: #{proposal.title}
    Summary: #{proposal.summary}
    Body: #{proposal.body}
    Risks: #{inspect(proposal.risks)}
    Benefits: #{inspect(proposal.benefits)}

    1. Argue FOR it (steelman) - strongest possible case
    2. Argue AGAINST it (red team) - strongest possible objections
    3. Synthesize - what's the honest assessment?

    Output valid JSON with: steelman (string), red_team (string), synthesis (string), \
    confidence_score (float 0-1), key_risks (array of strings), key_benefits (array of strings).
    """

    case Ema.Claude.AI.run(prompt) do
      {:ok, result} ->
        gen_log = proposal.generation_log || %{}
        updated_log = Map.put(gen_log, "debater", result)

        attrs = %{
          steelman: result["steelman"],
          red_team: result["red_team"],
          synthesis: result["synthesis"],
          confidence: parse_confidence(result["confidence_score"]),
          risks: result["key_risks"] || proposal.risks,
          benefits: result["key_benefits"] || proposal.benefits,
          generation_log: updated_log
        }

        case Ema.Proposals.update_proposal(proposal, attrs) do
          {:ok, updated} ->
            Logger.info(
              "Debater: debated proposal #{updated.id}, confidence: #{updated.confidence}"
            )

            Phoenix.PubSub.broadcast(
              Ema.PubSub,
              "proposals:pipeline",
              {:proposals, :debated, updated}
            )

          {:error, reason} ->
            Logger.error("Debater: failed to update proposal: #{inspect(reason)}")
        end

      {:error, reason} ->
        Logger.warning(
          "Debater: Claude CLI failed for proposal #{proposal.id}: #{inspect(reason)}"
        )

        # Pass through to tagger without debate data
        Phoenix.PubSub.broadcast(
          Ema.PubSub,
          "proposals:pipeline",
          {:proposals, :debated, proposal}
        )
    end
  end

  defp parse_confidence(nil), do: nil

  defp parse_confidence(value) when is_float(value) do
    value |> max(0.0) |> min(1.0)
  end

  defp parse_confidence(value) when is_integer(value) do
    (value / 1.0) |> max(0.0) |> min(1.0)
  end

  defp parse_confidence(_), do: nil
end
