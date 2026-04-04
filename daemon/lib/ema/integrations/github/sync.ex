defmodule Ema.Integrations.GitHub.Sync do
  @moduledoc "Links EMA projects to GitHub repos and pulls latest data."

  alias Ema.Projects
  alias Ema.Integrations.GitHub.Client

  def link_project(project_id, repo_full_name) do
    project = Projects.get_project!(project_id)
    url = "https://github.com/#{repo_full_name}"
    Projects.update_project(project, %{github_repo_url: url})
  end

  def pull_latest(project_id) do
    project = Projects.get_project!(project_id)

    case extract_repo_name(project.github_repo_url) do
      nil -> {:error, :no_github_repo}
      repo_name -> Client.get_commits(repo_name)
    end
  end

  defp extract_repo_name(nil), do: nil

  defp extract_repo_name(url) do
    case URI.parse(url) do
      %URI{path: "/" <> path} -> String.trim_trailing(path, ".git")
      _ -> nil
    end
  end
end
