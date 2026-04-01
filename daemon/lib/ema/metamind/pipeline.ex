defmodule Ema.MetaMind.Pipeline do
  @moduledoc """
  Orchestrates the review flow:
  original prompt -> parallel expert reviews -> merge suggestions ->
  revised prompt -> optional human override -> dispatch.

  Each stage broadcasts via PubSub for live UI updates.
  """

  require Logger

  @stages [:intercepted, :reviewing, :merging, :revised, :dispatched]

  def stages, do: @stages

  @doc """
  Run the full review pipeline on a prompt.
  Returns {:ok, %{revised_prompt: ..., reviews: ..., merge_result: ...}}
  """
  def run(prompt, opts \\ []) do
    intercept_id = Keyword.get(opts, :intercept_id, Ecto.UUID.generate())

    with {:ok, stage_1} <- stage_review(prompt, intercept_id),
         {:ok, stage_2} <- stage_merge(prompt, stage_1, intercept_id),
         {:ok, stage_3} <- stage_revise(prompt, stage_2, intercept_id) do
      broadcast(intercept_id, :dispatched, stage_3)
      {:ok, stage_3}
    else
      {:error, reason} ->
        Logger.warning("Pipeline failed at stage: #{inspect(reason)}")
        broadcast(intercept_id, :dispatched, %{original_prompt: prompt, error: reason})
        {:ok, %{original_prompt: prompt}}
    end
  end

  defp stage_review(prompt, intercept_id) do
    broadcast(intercept_id, :reviewing, %{prompt: prompt})

    case Ema.MetaMind.Reviewer.review(prompt) do
      {:ok, reviews} ->
        {:ok, %{reviews: reviews, prompt: prompt}}

      {:error, reason} ->
        {:error, {:review_failed, reason}}
    end
  end

  defp stage_merge(original_prompt, %{reviews: reviews}, intercept_id) do
    broadcast(intercept_id, :merging, %{reviews: reviews})

    suggestions =
      reviews
      |> Enum.flat_map(fn {_expert, review} -> review.suggestions end)
      |> Enum.uniq()

    avg_score =
      reviews
      |> Enum.map(fn {_expert, review} -> review.score end)
      |> then(fn scores ->
        if Enum.empty?(scores), do: 0.0, else: Enum.sum(scores) / length(scores)
      end)
      |> Float.round(3)

    revised_sections =
      reviews
      |> Enum.filter(fn {_expert, review} -> review.revised_section != nil end)
      |> Enum.map(fn {expert, review} -> {expert, review.revised_section} end)

    {:ok,
     %{
       reviews: reviews,
       suggestions: suggestions,
       avg_score: avg_score,
       revised_sections: revised_sections,
       original_prompt: original_prompt
     }}
  end

  defp stage_revise(original_prompt, merge_result, intercept_id) do
    if merge_result.avg_score >= 0.8 and Enum.empty?(merge_result.suggestions) do
      result = %{
        revised_prompt: original_prompt,
        original_prompt: original_prompt,
        reviews: merge_result.reviews,
        merge_result: merge_result,
        was_modified: false
      }

      broadcast(intercept_id, :revised, result)
      {:ok, result}
    else
      revision_prompt = build_revision_prompt(original_prompt, merge_result)

      revised =
        case Ema.Claude.Runner.run(revision_prompt, model: "haiku") do
          {:ok, %{"revised_prompt" => revised}} -> revised
          {:ok, %{"result" => revised}} when is_binary(revised) -> revised
          _ -> original_prompt
        end

      result = %{
        revised_prompt: revised,
        original_prompt: original_prompt,
        reviews: merge_result.reviews,
        merge_result: merge_result,
        was_modified: revised != original_prompt
      }

      broadcast(intercept_id, :revised, result)
      {:ok, result}
    end
  end

  defp build_revision_prompt(original, merge_result) do
    suggestions_text =
      merge_result.suggestions
      |> Enum.map_join("\n", &"- #{&1}")

    sections_text =
      merge_result.revised_sections
      |> Enum.map_join("\n\n", fn {expert, section} ->
        "### #{expert} suggestion:\n#{section}"
      end)

    """
    You are a prompt revision specialist. Improve the following prompt based on expert feedback.

    ## Original Prompt:
    #{original}

    ## Expert Suggestions:
    #{suggestions_text}

    ## Revised Sections from Experts:
    #{sections_text}

    ## Average Expert Score: #{merge_result.avg_score}/1.0

    Respond with JSON: {"revised_prompt": "the improved prompt"}
    Keep the core intent intact. Only improve clarity, completeness, and effectiveness.
    """
  end

  defp broadcast(intercept_id, stage, payload) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "metamind:pipeline",
      {:metamind, stage, Map.put(payload, :intercept_id, intercept_id)}
    )
  end
end
