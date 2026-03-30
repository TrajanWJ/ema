defmodule Ema.ProposalEngine.Generator do
  @moduledoc """
  Receives seeds, builds prompts via ContextManager, calls Claude Runner,
  and creates raw proposals. Passes results to Refiner.
  """

  use GenServer

  require Logger

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def generate(seed) do
    GenServer.cast(__MODULE__, {:generate, seed})
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    {:ok, %{generating: 0, total_generated: 0}}
  end

  @impl true
  def handle_cast({:generate, seed}, state) do
    state = %{state | generating: state.generating + 1}

    # Run in a Task to avoid blocking the GenServer
    Task.start(fn ->
      do_generate(seed)
    end)

    {:noreply, state}
  end

  @impl true
  def handle_info({:generation_complete, _result}, state) do
    {:noreply,
     %{state | generating: state.generating - 1, total_generated: state.total_generated + 1}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp do_generate(seed) do
    project =
      if seed.project_id do
        Ema.Projects.get_project(seed.project_id)
      end

    prompt =
      Ema.Claude.ContextManager.build_prompt(seed, project: project, stage: :generator)

    case Ema.Claude.Runner.run(prompt) do
      {:ok, result} ->
        create_proposal_from_result(seed, result)

      {:error, reason} ->
        Logger.warning(
          "Generator: Claude CLI call failed for seed #{seed.id}: #{inspect(reason)}"
        )

        :error
    end
  end

  defp create_proposal_from_result(seed, result) do
    attrs = %{
      title: result["title"] || "Untitled Proposal from #{seed.name}",
      summary: result["summary"],
      body: result["body"],
      estimated_scope: result["estimated_scope"],
      risks: result["risks"] || [],
      benefits: result["benefits"] || [],
      project_id: seed.project_id,
      seed_id: seed.id,
      generation_log: %{"generator" => result}
    }

    case Ema.Proposals.create_proposal(attrs) do
      {:ok, proposal} ->
        Logger.info("Generator: created proposal #{proposal.id} from seed #{seed.id}")
        Ema.ProposalEngine.Refiner.refine(proposal)
        {:ok, proposal}

      {:error, reason} ->
        Logger.error("Generator: failed to create proposal: #{inspect(reason)}")
        {:error, reason}
    end
  end
end
