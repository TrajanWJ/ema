defmodule Ema.ProposalEngine.ParliamentDebater do
  @moduledoc """
  Alternative debater that runs the Parliament-in-One-Call deliberation
  instead of the classic steelman/red-team/synthesis blob.

  Subscribes to `{:proposals, :refined}` and publishes `{:proposals, :debated}`,
  the same contract as `Ema.ProposalEngine.Debater`. To avoid double-debating,
  the supervisor should start either the classic Debater OR this one — never
  both. Selection is driven by `config :ema, :debater_strategy`:

      config :ema, :debater_strategy, :parliament   # use this module
      config :ema, :debater_strategy, :classic      # use Ema.ProposalEngine.Debater

  Pattern source: OpenKoi research — "Parliament-in-One-Call".
  """

  use GenServer
  require Logger

  alias Ema.ProposalEngine.Parliament

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "proposals:pipeline")
    {:ok, %{}}
  end

  @impl true
  def handle_info({:proposals, :refined, proposal}, state) do
    Task.Supervisor.start_child(Ema.ProposalEngine.TaskSupervisor, fn ->
      run_parliament(proposal)
    end)

    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp run_parliament(proposal) do
    case Parliament.deliberate(proposal) do
      {:ok, deliberation} ->
        gen_log = proposal.generation_log || %{}
        updated_log = Map.put(gen_log, "parliament", to_log(deliberation))

        attrs = %{
          synthesis: deliberation.synthesis,
          confidence: deliberation.confidence,
          generation_log: updated_log
        }

        case Ema.Proposals.update_proposal(proposal, attrs) do
          {:ok, updated} ->
            Logger.info(
              "ParliamentDebater: proposal #{updated.id} confidence=#{inspect(updated.confidence)} any_reject=#{deliberation.any_reject}"
            )

            Phoenix.PubSub.broadcast(
              Ema.PubSub,
              "proposals:pipeline",
              {:proposals, :debated, updated}
            )

          {:error, reason} ->
            Logger.error("ParliamentDebater: update failed: #{inspect(reason)}")
        end

      {:error, reason} ->
        Logger.warning(
          "ParliamentDebater: deliberation failed for proposal #{proposal.id}: #{inspect(reason)}"
        )

        Phoenix.PubSub.broadcast(
          Ema.PubSub,
          "proposals:pipeline",
          {:proposals, :debated, proposal}
        )
    end
  end

  defp to_log(d) do
    %{
      "guardian" => agency(d.guardian),
      "economist" => agency(d.economist),
      "empath" => agency(d.empath),
      "scholar" => agency(d.scholar),
      "strategist" => agency(d.strategist),
      "synthesis" => d.synthesis,
      "confidence" => d.confidence,
      "any_reject" => d.any_reject
    }
  end

  defp agency(%{verdict: v, reasoning: r}),
    do: %{"verdict" => Atom.to_string(v), "reasoning" => r}

  defp agency(_), do: %{"verdict" => "unknown", "reasoning" => ""}
end
