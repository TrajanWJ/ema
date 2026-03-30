defmodule Ema.ProposalEngine.Debater do
  @moduledoc """
  Runs steelman/red-team/synthesis debate on proposals.
  Sets the confidence score and passes to Tagger.
  """

  use GenServer

  require Logger

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def debate(proposal) do
    GenServer.cast(__MODULE__, {:debate, proposal})
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    {:ok, %{debating: 0}}
  end

  @impl true
  def handle_cast({:debate, proposal}, state) do
    Task.start(fn -> do_debate(proposal) end)
    {:noreply, %{state | debating: state.debating + 1}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

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

    case Ema.Claude.Runner.run(prompt) do
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
            Logger.info("Debater: debated proposal #{updated.id}, confidence: #{updated.confidence}")
            Ema.ProposalEngine.Tagger.tag(updated)

          {:error, reason} ->
            Logger.error("Debater: failed to update proposal: #{inspect(reason)}")
        end

      {:error, reason} ->
        Logger.warning("Debater: Claude CLI failed for proposal #{proposal.id}: #{inspect(reason)}")
        # Pass through to tagger without debate data
        Ema.ProposalEngine.Tagger.tag(proposal)
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
