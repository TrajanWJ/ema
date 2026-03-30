defmodule Ema.ClaudeSessions.SessionLinker do
  @moduledoc """
  Matches parsed Claude sessions to EMA projects by comparing
  the session's project_path against Project.linked_path.
  """

  alias Ema.Projects

  @doc """
  Attempt to link a parsed session to a project.

  Returns {:ok, project_id} if a matching project is found,
  or :unlinked if no match.
  """
  @spec link(map()) :: {:ok, String.t()} | :unlinked
  def link(%{project_path: nil}), do: :unlinked

  def link(%{project_path: project_path}) do
    match_project_path(project_path)
  end

  defp match_project_path(session_path) do
    projects = Projects.list_projects()

    match =
      Enum.find(projects, fn project ->
        project.linked_path != nil and paths_match?(project.linked_path, session_path)
      end)

    case match do
      nil -> :unlinked
      project -> {:ok, project.id}
    end
  end

  defp paths_match?(linked_path, session_path) do
    # Normalize trailing slashes for comparison
    normalize(linked_path) == normalize(session_path) or
      String.starts_with?(normalize(session_path), normalize(linked_path) <> "/") or
      String.starts_with?(normalize(linked_path), normalize(session_path) <> "/")
  end

  defp normalize(path) do
    path
    |> Path.expand()
    |> String.trim_trailing("/")
  end
end
