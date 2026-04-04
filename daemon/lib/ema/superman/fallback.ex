defmodule Ema.Superman.Fallback do
  @moduledoc """
  Week 7 fallback implementation of Superman context_for/2.
  File-based when .superman file is present in vault; assembles from DB otherwise.

  .superman file location (checked in order):
    <vault_path>/projects/<project.slug>/.superman
    <vault_path>/projects/<project.name>/.superman
    <vault_path>/<project.name>/.superman
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Projects.Project
  alias Ema.Tasks.Task
  alias Ema.Proposals.Proposal
  alias Ema.Executions.Execution

  @doc """
  Returns {:ok, context_string, source} where source is :file or :db.
  """
  def context_for(%Project{} = project) do
    case find_superman_file(project) do
      {:ok, content} -> {:ok, content, :file}
      :not_found -> {:ok, build_context_from_db(project), :db}
    end
  end

  def context_for(project_id) when is_binary(project_id) do
    case Ema.Projects.get_project(project_id) do
      nil -> {:error, :not_found}
      project -> context_for(project)
    end
  end

  # ---------------------------------------------------------------------------
  # .superman file lookup
  # ---------------------------------------------------------------------------

  @doc """
  Looks for a .superman file in vault locations for the given project.
  Returns {:ok, content} or :not_found.
  """
  def find_superman_file(%Project{} = project) do
    vault = Ema.Config.vault_path()
    slug = project.slug || slugify(project.name)
    name = project.name

    candidates = [
      Path.join([vault, "projects", slug, ".superman"]),
      Path.join([vault, "projects", name, ".superman"]),
      Path.join([vault, name, ".superman"])
    ]

    Enum.find_value(candidates, :not_found, fn path ->
      case File.read(path) do
        {:ok, content} -> {:ok, content}
        _ -> nil
      end
    end)
  end

  # ---------------------------------------------------------------------------
  # DB-assembled context
  # ---------------------------------------------------------------------------

  defp build_context_from_db(%Project{} = project) do
    tasks = recent_tasks(project.id)
    proposals = recent_proposals(project.id)
    executions = recent_executions(project)

    header = "SUPERMAN CONTEXT \u2014 #{project.name}"
    separator = String.duplicate("\u2550", 32)

    intent_text = project.description || "No description set"

    tasks_lines =
      if Enum.empty?(tasks) do
        ["(none)"]
      else
        Enum.map(tasks, fn t -> "- #{t.title} [#{t.status}]" end)
      end

    proposals_lines =
      if Enum.empty?(proposals) do
        ["(none)"]
      else
        Enum.map(proposals, fn p ->
          preview = p.body |> String.slice(0, 100) |> String.replace("\n", " ")
          "- #{preview} [#{p.status}]"
        end)
      end

    outcomes_lines =
      if Enum.empty?(executions) do
        ["(none)"]
      else
        Enum.map(executions, fn e ->
          completed = format_dt(e.completed_at)
          "- #{e.status} at #{completed}"
        end)
      end

    [
      header,
      separator,
      "",
      "INTENT:",
      intent_text,
      "",
      "RECENT TASKS:"
      | tasks_lines
    ] ++
      ["", "RECENT PROPOSALS:"] ++
      proposals_lines ++
      ["", "PRIOR OUTCOMES:"] ++
      outcomes_lines
    |> Enum.join("\n")
  end

  # ---------------------------------------------------------------------------
  # Queries
  # ---------------------------------------------------------------------------

  defp recent_tasks(project_id) do
    Task
    |> where([t], t.project_id == ^project_id)
    |> order_by([t], desc: t.inserted_at)
    |> limit(5)
    |> Repo.all()
  rescue
    _ -> []
  end

  defp recent_proposals(project_id) do
    Proposal
    |> where([p], p.project_id == ^project_id)
    |> order_by([p], desc: p.inserted_at)
    |> limit(3)
    |> Repo.all()
  rescue
    _ -> []
  end

  defp recent_executions(%Project{} = project) do
    slug = project.slug || slugify(project.name)

    Execution
    |> where([e], e.project_slug == ^slug and e.status == "completed")
    |> order_by([e], desc: e.completed_at)
    |> limit(5)
    |> Repo.all()
  rescue
    _ -> []
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp format_dt(nil), do: "unknown"
  defp format_dt(%DateTime{} = dt), do: DateTime.to_iso8601(dt)
  defp format_dt(_), do: "unknown"

  defp slugify(name) when is_binary(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/, "-")
    |> String.trim("-")
  end

  defp slugify(_), do: "unknown"
end
