defmodule Ema.Intelligence.ReflexionStore do
  @moduledoc "Postgres-backed storage for reflexion lessons."

  import Ecto.Query

  alias Ema.Intelligence.ReflexionEntry
  alias Ema.Repo

  def record(agent, domain, project_slug, lesson, status)
      when is_binary(agent) and is_binary(domain) and is_binary(project_slug) and
             is_binary(status) do
    lesson = normalize_lesson(lesson)

    if lesson == "" do
      {:error, :empty_lesson}
    else
      create_entry(%{
        agent: agent,
        domain: domain,
        project_slug: project_slug,
        lesson: lesson,
        outcome_status: status
      })
    end
  end

  def create_entry(attrs) when is_map(attrs) do
    %ReflexionEntry{}
    |> ReflexionEntry.changeset(attrs)
    |> Repo.insert()
  end

  def list_recent(opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)

    ReflexionEntry
    |> maybe_filter(:agent, opts[:agent])
    |> maybe_filter(:domain, opts[:domain])
    |> maybe_filter(:project_slug, opts[:project_slug])
    |> order_by([entry], desc: entry.inserted_at)
    |> limit(^limit)
    |> Repo.all()
  end

  def last_entries(agent, domain, project_slug, limit \\ 3) do
    ReflexionEntry
    |> where(
      [entry],
      entry.agent == ^agent and entry.domain == ^domain and entry.project_slug == ^project_slug
    )
    |> order_by([entry], desc: entry.inserted_at)
    |> limit(^limit)
    |> Repo.all()
  end

  defp maybe_filter(query, _field_name, nil), do: query
  defp maybe_filter(query, _field_name, ""), do: query

  defp maybe_filter(query, field_name, value) do
    where(query, [entry], field(entry, ^field_name) == ^value)
  end

  defp normalize_lesson(nil), do: ""

  defp normalize_lesson(lesson) when is_binary(lesson) do
    lesson
    |> String.trim()
    |> String.slice(0, 2_000)
  end

  defp normalize_lesson(lesson), do: lesson |> to_string() |> normalize_lesson()
end
