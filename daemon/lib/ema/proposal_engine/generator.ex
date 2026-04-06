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
    case Ema.Proposals.SeedPreflight.check(seed) do
      {:pass, checked_seed, diagnostics} ->
        do_generate_after_preflight(checked_seed, diagnostics)

      {:rewrite, checked_seed, diagnostics} ->
        do_generate_after_preflight(checked_seed, diagnostics)

      {:duplicate, _nil, diagnostics} ->
        Logger.info(
          "Generator: seed #{seed.id} blocked as duplicate: #{inspect(diagnostics[:duplicate_info])}"
        )

        :duplicate

      {:reject, _nil, diagnostics} ->
        Logger.info(
          "Generator: seed #{seed.id} rejected by preflight (score: #{diagnostics[:initial_score]})"
        )

        :rejected
    end
  end

  defp do_generate_after_preflight(seed, preflight_diagnostics) do
    project =
      if seed.project_id do
        Ema.Projects.get_project(seed.project_id)
      end

    gap_context = build_gap_context(seed)
    relevant_code_context = build_relevant_code_context(project, seed)

    prompt =
      Ema.Claude.ContextManager.build_prompt(seed,
        project: project,
        stage: :generator,
        gap_context: gap_context,
        relevant_code_context: relevant_code_context
      )

    case Ema.Claude.AI.run(prompt, stage: :generator) do
      {:ok, result} ->
        create_proposal_from_result(seed, result, preflight_diagnostics)

      {:error, reason} ->
        Logger.warning(
          "Generator: Claude CLI call failed for seed #{seed.id}: #{inspect(reason)}"
        )

        Ema.ProposalEngine.Diagnostics.record_generation_error(seed, reason)

        failure = Ema.Claude.Failure.classify_generation_error(reason, seed_id: seed.id)
        Ema.Claude.Failure.record(failure, artifact_id: to_string(seed.id), artifact_type: :seed)
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

  defp build_relevant_code_context(%Ema.Projects.Project{slug: slug}, seed) do
    task_title =
      seed.name
      |> to_string()
      |> String.trim()

    Ema.Intelligence.ContextFetcher.fetch(slug, task_title)
  end

  defp build_relevant_code_context(_, _), do: nil

  defp normalize_estimated_scope(nil), do: nil

  defp normalize_estimated_scope(scope) when is_binary(scope) do
    normalized =
      scope
      |> String.trim()
      |> String.downcase()

    cond do
      normalized in ["xs", "extra small", "extra-small", "tiny", "trivial"] -> "xs"
      normalized in ["s", "small"] -> "s"
      normalized in ["m", "medium", "med"] -> "m"
      normalized in ["l", "large"] -> "l"
      normalized in ["xl", "extra large", "extra-large", "very large"] -> "xl"
      String.contains?(normalized, "extra large") -> "xl"
      String.contains?(normalized, "very large") -> "xl"
      String.contains?(normalized, "medium to large") -> "l"
      String.contains?(normalized, "small to medium") -> "m"
      String.contains?(normalized, "medium") -> "m"
      String.contains?(normalized, "large") -> "l"
      String.contains?(normalized, "small") -> "s"
      true -> nil
    end
  end

  defp normalize_estimated_scope(_), do: nil

  defp create_proposal_from_result(seed, result, preflight_diagnostics) do
    preflight_score =
      preflight_diagnostics[:enriched_score] || preflight_diagnostics[:initial_score]

    attrs = %{
      title: result["title"] || "Untitled Proposal from #{seed.name}",
      summary: result["summary"],
      body: result["body"],
      estimated_scope: normalize_estimated_scope(result["estimated_scope"]),
      risks: result["risks"] || [],
      benefits: result["benefits"] || [],
      project_id: seed.project_id,
      seed_id: seed.id,
      prompt_quality_score: preflight_score && preflight_score / 100.0,
      score_breakdown:
        preflight_diagnostics[:score_breakdown] || preflight_diagnostics[:enriched_breakdown],
      generation_log: %{
        "generator" => result,
        "preflight" => sanitize_diagnostics(preflight_diagnostics)
      }
    }

    case Ema.Proposals.create_proposal(attrs) do
      {:ok, proposal} ->
        Ema.ProposalEngine.Diagnostics.record_generation_ok(seed, proposal)

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
        Ema.ProposalEngine.Diagnostics.record_generation_error(seed, reason)
        {:error, reason}
    end
  end

  # Convert diagnostics map to JSON-safe format for generation_log storage
  defp sanitize_diagnostics(diag) when is_map(diag) do
    diag
    |> Map.drop([:score_breakdown, :enriched_breakdown])
    |> Enum.map(fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), sanitize_value(v)}
      {k, v} -> {k, sanitize_value(v)}
    end)
    |> Map.new()
  end

  defp sanitize_diagnostics(_), do: %{}

  defp sanitize_value(v) when is_atom(v), do: Atom.to_string(v)
  defp sanitize_value(v) when is_map(v), do: sanitize_diagnostics(v)

  defp sanitize_value(v) when is_list(v) do
    Enum.map(v, fn
      {k, val} when is_atom(k) -> %{Atom.to_string(k) => sanitize_value(val)}
      item -> sanitize_value(item)
    end)
  end

  defp sanitize_value(v), do: v
end
