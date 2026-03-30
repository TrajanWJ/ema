defmodule Ema.Claude.ContextManager do
  @moduledoc """
  Builds context-enriched prompts for the proposal pipeline.
  Injects project context, recent proposals, and active tasks into seed prompts.
  """

  import Ecto.Query
  alias Ema.Repo

  @doc """
  Build a full prompt from a seed template and contextual data.

  Options:
    - :project - Project struct to scope context to
    - :stage - pipeline stage (:generator, :refiner, :debater, :tagger)
  """
  def build_prompt(seed, opts \\ []) do
    project = Keyword.get(opts, :project)
    stage = Keyword.get(opts, :stage, :generator)

    context = %{
      project_context: project && build_project_context(project),
      recent_proposals: build_recent_proposals(project, stage),
      active_tasks: build_active_tasks(project)
    }

    assemble(seed.prompt_template, context, stage)
  end

  defp build_project_context(project) do
    context_path =
      Path.join([
        System.get_env("HOME", "~"),
        ".local/share/ema/projects",
        project.slug,
        "context.md"
      ])

    file_context =
      case File.read(context_path) do
        {:ok, content} -> content
        {:error, _} -> nil
      end

    %{
      name: project.name,
      description: project.description,
      status: project.status,
      context_document: file_context
    }
  end

  defp build_recent_proposals(project, _stage) do
    query =
      Ema.Proposals.Proposal
      |> order_by(desc: :inserted_at)
      |> limit(10)

    query =
      if project do
        where(query, [p], p.project_id == ^project.id)
      else
        query
      end

    query
    |> Repo.all()
    |> Enum.map(fn p ->
      %{title: p.title, summary: p.summary, status: p.status, confidence: p.confidence}
    end)
  end

  defp build_active_tasks(nil), do: []

  defp build_active_tasks(project) do
    Ema.Tasks.Task
    |> where([t], t.project_id == ^project.id)
    |> where([t], t.status == "in_progress")
    |> order_by(asc: :priority)
    |> limit(10)
    |> Repo.all()
    |> Enum.map(fn t ->
      %{title: t.title, status: t.status, priority: t.priority, effort: t.effort}
    end)
  end

  defp assemble(template, context, stage) do
    stage_prefix = stage_instruction(stage)

    context_block =
      context
      |> Enum.reject(fn {_k, v} -> is_nil(v) or v == [] end)
      |> Enum.map_join("\n\n", fn {key, value} ->
        "## #{format_key(key)}\n#{format_value(value)}"
      end)

    """
    #{stage_prefix}

    #{context_block}

    ## Seed Prompt
    #{template}

    Respond with valid JSON containing: title, summary, body, estimated_scope, risks (array), benefits (array).
    """
  end

  defp stage_instruction(:generator) do
    "You are a proposal generator. Generate a concrete, actionable proposal based on the following context and prompt."
  end

  defp stage_instruction(:refiner) do
    "You are a critical reviewer. Strengthen this proposal: find weaknesses, sharpen the approach, remove hand-waving, make it concrete."
  end

  defp stage_instruction(:debater) do
    "Argue for this proposal (steelman), argue against it (red team), then synthesize. Output: confidence_score (0-1), steelman, red_team, synthesis, key_risks[], key_benefits[]."
  end

  defp stage_instruction(:tagger) do
    "Analyze this proposal and assign tags. Output JSON with tags: [{category: 'domain'|'type'|'custom', label: string}]."
  end

  defp format_key(key) do
    key |> Atom.to_string() |> String.replace("_", " ") |> String.capitalize()
  end

  defp format_value(value) when is_list(value) do
    value
    |> Enum.map_join("\n", fn item ->
      case item do
        %{title: title} -> "- #{title}"
        other -> "- #{inspect(other)}"
      end
    end)
  end

  defp format_value(%{context_document: doc} = ctx) when is_binary(doc) do
    "Project: #{ctx.name} (#{ctx.status})\n#{ctx.description || ""}\n\n### Context Document\n#{doc}"
  end

  defp format_value(%{name: name} = ctx) do
    "Project: #{name} (#{ctx.status})\n#{ctx.description || ""}"
  end

  defp format_value(value) when is_binary(value), do: value
  defp format_value(value), do: inspect(value)
end
