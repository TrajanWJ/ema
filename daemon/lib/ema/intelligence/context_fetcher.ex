defmodule Ema.Intelligence.ContextFetcher do
  @moduledoc """
  Fetches the most relevant stored context fragments for a project and task title.
  """

  import Ecto.Query

  alias Ema.Intelligence.ContextStore
  alias Ema.Repo

  @doc """
  Returns a formatted context block built from the top 5 ranked fragments.
  """
  def fetch(project_slug, task_title) when is_binary(project_slug) and is_binary(task_title) do
    fragments = ranked_fragments(project_slug, task_title)

    case fragments do
      [] ->
        nil

      entries ->
        entries
        |> Enum.map_join("\n\n", &format_fragment/1)
        |> then(&"Relevant code context:\n" <> &1)
    end
  end

  def fetch(_, _), do: nil

  def ranked_fragments(project_slug, task_title) do
    terms = search_terms(task_title)

    ContextStore
    |> where([cf], cf.project_slug == ^project_slug)
    |> order_by([cf], desc: cf.relevance_score, desc: cf.inserted_at)
    |> limit(50)
    |> Repo.all()
    |> Enum.sort_by(&rank_fragment(&1, terms), :desc)
    |> Enum.take(5)
  end

  defp search_terms(task_title) do
    task_title
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9_\-\/ ]/u, " ")
    |> String.split(~r/\s+/, trim: true)
    |> Enum.uniq()
    |> Enum.reject(&(String.length(&1) < 3))
    |> Enum.take(8)
  end

  defp rank_fragment(fragment, terms) do
    term_boost =
      Enum.reduce(terms, 0.0, fn term, acc ->
        content = String.downcase(fragment.content || "")
        file_path = String.downcase(fragment.file_path || "")

        acc +
          cond do
            String.contains?(content, term) -> 0.35
            String.contains?(file_path, term) -> 0.2
            true -> 0.0
          end
      end)

    fragment.relevance_score + term_boost
  end

  defp format_fragment(fragment) do
    path = fragment.file_path || "unknown"
    score = Float.round(fragment.relevance_score, 3)

    """
    [#{path}] score=#{score}
    #{fragment.content}
    """
    |> String.trim()
  end
end
