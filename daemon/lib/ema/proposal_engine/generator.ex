defmodule Ema.ProposalEngine.Generator do
  @moduledoc """
  Receives seeds, builds prompts via ContextManager, calls Claude Runner,
  and creates raw proposals. Publishes {:proposals, :generated} via PubSub
  to kick off the pipeline.
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
    {:ok, %{total_generated: 0}}
  end

  @impl true
  def handle_cast({:generate, seed}, state) do
    Task.Supervisor.start_child(Ema.ProposalEngine.TaskSupervisor, fn ->
      do_generate(seed)
    end)

    {:noreply, %{state | total_generated: state.total_generated + 1}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp do_generate(seed) do
    project =
      if seed.project_id do
        Ema.Projects.get_project(seed.project_id)
      end

    gap_context = build_gap_context(seed)

    prompt =
      Ema.Claude.ContextManager.build_prompt(seed,
        project: project,
        stage: :generator,
        gap_context: gap_context
      )

    case Ema.Claude.AI.run(prompt) do
      {:ok, result} ->
        create_proposal_from_result(seed, result)

      {:error, reason} ->
        Logger.warning(
          "Generator: Claude CLI call failed for seed #{seed.id}: #{inspect(reason)}"
        )

        :error
    end
  end

  defp build_gap_context(seed) do
    case Ema.Vectors.Embedder.embed_text(seed.prompt_template) do
      {:ok, vector} ->
        # Find code areas least covered by existing proposals
        code_entries = Ema.Vectors.Index.entries_for_project(seed.project_id)

        proposal_entries =
          code_entries
          |> Enum.filter(fn entry -> entry[:kind] == :proposal end)
          |> Enum.map(fn entry -> entry.embedding end)

        # Find code chunks with lowest max-similarity to any proposal
        gaps =
          code_entries
          |> Enum.reject(fn entry -> entry[:kind] == :proposal end)
          |> Enum.map(fn entry ->
            max_sim =
              case proposal_entries do
                [] ->
                  0.0

                proposals ->
                  proposals
                  |> Enum.map(&Ema.Vectors.Index.cosine_similarity(entry.embedding, &1))
                  |> Enum.max()
              end

            {entry, max_sim}
          end)
          |> Enum.sort_by(fn {_entry, sim} -> sim end, :asc)
          |> Enum.take(5)

        case gaps do
          [] ->
            nil

          gap_list ->
            summaries =
              gap_list
              |> Enum.map(fn {entry, sim} ->
                path = entry[:path] || "unknown"
                "- #{path} (coverage: #{Float.round(sim * 100, 0)}%): #{String.slice(entry.text, 0..120)}"
              end)
              |> Enum.join("\n")

            %{
              uncovered_areas: summaries,
              seed_similarity: Ema.Vectors.Index.cosine_similarity(vector, vector)
            }
        end

      {:error, _reason} ->
        nil
    end
  rescue
    _ -> nil
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
        if attrs[:brain_dump_item_id] do
          Ema.Executions.link_proposal(attrs[:brain_dump_item_id], proposal.id)
        end

        Logger.info("Generator: created proposal #{proposal.id} from seed #{seed.id}")

        Phoenix.PubSub.broadcast(
          Ema.PubSub,
          "proposals:pipeline",
          {:proposals, :generated, proposal}
        )

        {:ok, proposal}

      {:error, reason} ->
        Logger.error("Generator: failed to create proposal: #{inspect(reason)}")
        {:error, reason}
    end
  end
end
