defmodule Ema.ProposalEngine.AutoDecomposer do
  @moduledoc """
  Breaks approved proposals into concrete tasks with dependency edges.

  Called asynchronously after proposal approval. Uses Claude (haiku) to
  generate a structured task breakdown, then creates tasks via `Ema.Tasks`
  and wires dependency edges via `Ema.Tasks.DependencyGraph`.

  All tasks are linked to the proposal via `source_type: "decomposition"`
  and `source_id: proposal.id`.
  """

  require Logger

  @max_tasks 7
  @min_tasks 2

  @doc """
  Decompose a proposal into tasks with dependencies.

  Returns `{:ok, tasks}` on success or `{:error, reason}` on failure.
  """
  def decompose(proposal) do
    prompt = build_prompt(proposal)

    case Ema.Claude.AI.run(prompt, model: "haiku", stage: :decomposer) do
      {:ok, result} ->
        case extract_tasks(result) do
          {:ok, task_specs} ->
            create_tasks(proposal, task_specs)

          {:error, reason} ->
            Logger.warning(
              "[AutoDecomposer] Failed to parse task specs for proposal #{proposal.id}: #{inspect(reason)}"
            )

            {:error, reason}
        end

      {:error, reason} ->
        Logger.warning(
          "[AutoDecomposer] Claude call failed for proposal #{proposal.id}: #{inspect(reason)}"
        )

        {:error, reason}
    end
  end

  # -- Prompt --

  defp build_prompt(proposal) do
    """
    Break this proposal into #{@min_tasks}-#{@max_tasks} concrete, implementable tasks.

    Proposal: #{proposal.title}
    Summary: #{proposal.summary || "No summary"}
    Body: #{String.slice(proposal.body || "", 0..1000)}
    Scope: #{proposal.estimated_scope || "unknown"}

    Return ONLY a JSON object with a "tasks" array. Each task object:
    {
      "title": "short actionable title",
      "description": "what specifically to do",
      "priority": <1-5 integer, 1=highest>,
      "effort": "<xs|s|m|l|xl>",
      "depends_on": [<indices of tasks this depends on, 0-based>]
    }

    Rules:
    - Each task should be completable in one focused session (1-4 hours)
    - Dependencies must form a DAG (no cycles)
    - At least one task must have empty depends_on (the starting point)
    - Include a verification/test task as the final task
    - Priority 1-2 for critical path, 3 for normal, 4-5 for nice-to-have
    - Use effort xs for <30min, s for 1h, m for 2h, l for 4h, xl for 8h+
    """
  end

  # -- Parse --

  defp extract_tasks(result) when is_map(result) do
    tasks =
      result["tasks"] ||
        get_in(result, ["result", "tasks"]) ||
        extract_from_raw(result)

    case tasks do
      list when is_list(list) and length(list) >= @min_tasks ->
        validated = Enum.take(list, @max_tasks)

        if Enum.all?(validated, &valid_task_spec?/1) do
          {:ok, validated}
        else
          {:error, :invalid_task_format}
        end

      list when is_list(list) ->
        {:error, {:too_few_tasks, length(list)}}

      nil ->
        {:error, :no_tasks_key}

      _ ->
        {:error, :unexpected_format}
    end
  end

  defp extract_tasks(_), do: {:error, :non_map_result}

  defp extract_from_raw(%{"raw" => raw}) when is_binary(raw) do
    case Jason.decode(raw) do
      {:ok, %{"tasks" => tasks}} -> tasks
      _ -> nil
    end
  end

  defp extract_from_raw(_), do: nil

  defp valid_task_spec?(spec) when is_map(spec) do
    is_binary(spec["title"]) and
      byte_size(spec["title"]) > 0 and
      is_list(Map.get(spec, "depends_on", []))
  end

  defp valid_task_spec?(_), do: false

  # -- Create --

  defp create_tasks(proposal, task_specs) do
    # Create tasks in order, collecting {index, task_id} for dependency wiring
    {created_tasks, _} =
      task_specs
      |> Enum.with_index()
      |> Enum.reduce({[], %{}}, fn {spec, index}, {acc, index_to_id} ->
        attrs = %{
          title: spec["title"],
          description: spec["description"] || "",
          priority: clamp_priority(spec["priority"]),
          effort: normalize_effort(spec["effort"]),
          status: "todo",
          source_type: "decomposition",
          source_id: proposal.id,
          project_id: proposal.project_id,
          actor_id: proposal.actor_id,
          metadata: %{
            "decomposed_from" => proposal.id,
            "decomposition_index" => index,
            "estimated_hours" => spec["estimated_hours"]
          }
        }

        case Ema.Tasks.create_task(attrs, force_dispatch: true) do
          {:ok, task} ->
            # Wire dependencies using previously created task IDs
            dep_indices = Map.get(spec, "depends_on", [])

            dep_ids =
              dep_indices
              |> Enum.filter(&is_integer/1)
              |> Enum.map(&Map.get(index_to_id, &1))
              |> Enum.reject(&is_nil/1)

            if dep_ids != [] do
              case Ema.Tasks.set_dependencies(task.id, dep_ids) do
                {:ok, _} ->
                  :ok

                {:error, reason} ->
                  Logger.warning(
                    "[AutoDecomposer] Failed to set deps for task #{task.id}: #{inspect(reason)}"
                  )
              end
            end

            {[task | acc], Map.put(index_to_id, index, task.id)}

          {:needs_deliberation, _} ->
            Logger.info(
              "[AutoDecomposer] Task #{index} needs deliberation, skipping: #{spec["title"]}"
            )

            {acc, index_to_id}

          {:requires_proposal, _} ->
            Logger.info(
              "[AutoDecomposer] Task #{index} requires proposal, skipping: #{spec["title"]}"
            )

            {acc, index_to_id}

          {:error, reason} ->
            Logger.warning(
              "[AutoDecomposer] Failed to create task #{index}: #{inspect(reason)}"
            )

            {acc, index_to_id}
        end
      end)

    tasks = Enum.reverse(created_tasks)

    Logger.info(
      "[AutoDecomposer] Created #{length(tasks)} tasks from proposal #{proposal.id}"
    )

    broadcast_decomposition(proposal, tasks)

    {:ok, tasks}
  end

  defp clamp_priority(p) when is_integer(p) and p >= 1 and p <= 5, do: p
  defp clamp_priority(_), do: 3

  @valid_efforts ~w(xs s m l xl)

  defp normalize_effort(e) when e in @valid_efforts, do: e
  defp normalize_effort(_), do: "m"

  defp broadcast_decomposition(proposal, tasks) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "proposals:events",
      {"proposal_decomposed", %{proposal_id: proposal.id, task_count: length(tasks)}}
    )

    EmaWeb.Endpoint.broadcast("proposals:queue", "proposal_decomposed", %{
      proposal_id: proposal.id,
      task_ids: Enum.map(tasks, & &1.id),
      task_count: length(tasks)
    })

    Ema.Pipes.EventBus.broadcast_event("proposals:decomposed", %{
      proposal_id: proposal.id,
      task_ids: Enum.map(tasks, & &1.id),
      task_count: length(tasks)
    })
  end
end
