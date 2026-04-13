defmodule Ema.Integrations.GitHub.Webhook do
  @moduledoc "Handles incoming GitHub webhook events."

  require Logger

  alias Ema.Projects
  alias Ema.Proposals
  alias Ema.Tasks

  def handle_event("push", %{"commits" => [_ | _] = commits, "repository" => repo}) do
    last_commit = List.last(commits)
    sha = last_commit["id"]
    message = last_commit["message"]
    repo_full_name = repo["full_name"]

    Logger.info("GitHub push: #{repo_full_name} #{String.slice(sha, 0..6)} — #{message}")

    case find_project_by_repo(repo_full_name) do
      nil -> :ok
      project -> Projects.update_project(project, %{last_commit_sha: sha})
    end
  end

  def handle_event("pull_request", %{"action" => "opened", "pull_request" => pr}) do
    title = pr["title"]
    body = pr["body"] || ""
    url = pr["html_url"]
    number = pr["number"]

    Logger.info("GitHub PR opened: ##{number} #{title}")

    Proposals.create_proposal(%{
      title: "PR ##{number}: #{title}",
      description: "#{body}\n\nSource: #{url}",
      source: "github_pr",
      status: "queued"
    })
  end

  def handle_event("issues", %{"action" => "opened", "issue" => issue}) do
    title = issue["title"]
    body = issue["body"] || ""
    url = issue["html_url"]
    number = issue["number"]

    Logger.info("GitHub issue opened: ##{number} #{title}")

    Tasks.create_task(%{
      title: "GH ##{number}: #{title}",
      description: "#{body}\n\nSource: #{url}",
      source: "github_issue",
      status: "todo"
    })
  end

  def handle_event(event_type, _payload) do
    Logger.debug("Unhandled GitHub event: #{event_type}")
    :ok
  end

  defp find_project_by_repo(repo_full_name) do
    url = "https://github.com/#{repo_full_name}"

    Projects.list_projects()
    |> Enum.find(&(&1.github_repo_url == url))
  end
end
