defmodule Ema.ProposalEngine.Refiner do
  @moduledoc """
  Takes raw proposals from the Generator and runs a critique pass via Claude.
  Updates the proposal body with refined content, then passes to Debater.
  """

  use GenServer

  require Logger

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def refine(proposal) do
    GenServer.cast(__MODULE__, {:refine, proposal})
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    {:ok, %{refining: 0}}
  end

  @impl true
  def handle_cast({:refine, proposal}, state) do
    Task.start(fn -> do_refine(proposal) end)
    {:noreply, %{state | refining: state.refining + 1}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp do_refine(proposal) do
    prompt = """
    You are a critical reviewer. Here is a proposal:

    Title: #{proposal.title}
    Summary: #{proposal.summary}
    Body: #{proposal.body}

    Strengthen it: find weaknesses, sharpen the approach, remove hand-waving, make it concrete.
    Output valid JSON with: title, summary, body, estimated_scope, risks (array), benefits (array).
    """

    case Ema.Claude.Runner.run(prompt) do
      {:ok, result} ->
        gen_log = proposal.generation_log || %{}
        updated_log = Map.put(gen_log, "refiner", result)

        attrs = %{
          body: result["body"] || proposal.body,
          summary: result["summary"] || proposal.summary,
          risks: result["risks"] || proposal.risks,
          benefits: result["benefits"] || proposal.benefits,
          generation_log: updated_log
        }

        case Ema.Proposals.update_proposal(proposal, attrs) do
          {:ok, updated} ->
            Logger.info("Refiner: refined proposal #{updated.id}")
            Ema.ProposalEngine.Debater.debate(updated)

          {:error, reason} ->
            Logger.error("Refiner: failed to update proposal: #{inspect(reason)}")
        end

      {:error, reason} ->
        Logger.warning("Refiner: Claude CLI failed for proposal #{proposal.id}: #{inspect(reason)}")
        # Pass through to debater even without refinement
        Ema.ProposalEngine.Debater.debate(proposal)
    end
  end
end
