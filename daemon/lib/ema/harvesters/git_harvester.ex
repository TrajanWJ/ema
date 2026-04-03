defmodule Ema.Harvesters.GitHarvester do
  @moduledoc """
  Scans configured git repos for stale branches and recent notable commits.
  Creates proposal seeds for cleanup or follow-up actions.
  """

  use Ema.Harvesters.Base, name: "git", interval: :timer.hours(6)

  alias Ema.Projects
  alias Ema.Proposals

  @stale_branch_days 30

  @impl Ema.Harvesters.Base
  def harvester_name, do: "git"

  @impl Ema.Harvesters.Base
  def default_interval, do: :timer.hours(6)

  @impl Ema.Harvesters.Base
  def harvest(_context) do
    projects = Projects.list_projects()

    results =
      projects
      |> Enum.filter(&has_git_path?/1)
      |> Enum.map(&scan_project/1)

    items_found = Enum.sum(Enum.map(results, & &1.stale_branches)) +
                  Enum.sum(Enum.map(results, & &1.notable_commits))
    seeds_created = Enum.sum(Enum.map(results, & &1.seeds_created))

    {:ok, %{items_found: items_found, seeds_created: seeds_created, metadata: %{projects_scanned: length(results)}}}
  end

  defp has_git_path?(%{path: path}) when is_binary(path), do: File.dir?(Path.join(path, ".git"))
  defp has_git_path?(_), do: false

  defp scan_project(project) do
    path = project.path
    stale = find_stale_branches(path)
    notable = find_notable_commits(path)
    seeds = create_seeds(project, stale, notable)

    %{stale_branches: length(stale), notable_commits: length(notable), seeds_created: seeds}
  end

  defp find_stale_branches(path) do
    cutoff = Date.utc_today() |> Date.add(-@stale_branch_days)

    case System.cmd("git", ["for-each-ref", "--sort=committerdate",
           "--format=%(refname:short)\t%(committerdate:iso8601)", "refs/heads/"],
           cd: path, stderr_to_stdout: true) do
      {output, 0} ->
        output
        |> String.split("\n", trim: true)
        |> Enum.filter(fn line ->
          case String.split(line, "\t") do
            [branch, date_str] ->
              branch not in ["main", "master"] and branch_is_stale?(date_str, cutoff)
            _ -> false
          end
        end)
        |> Enum.map(fn line ->
          [branch, date_str] = String.split(line, "\t")
          %{branch: branch, last_commit: date_str}
        end)

      _ -> []
    end
  end

  defp branch_is_stale?(date_str, cutoff) do
    case Date.from_iso8601(String.slice(date_str, 0..9)) do
      {:ok, date} -> Date.compare(date, cutoff) == :lt
      _ -> false
    end
  end

  defp find_notable_commits(path) do
    since = Date.utc_today() |> Date.add(-7) |> Date.to_iso8601()

    case System.cmd("git", ["log", "--since=#{since}", "--pretty=format:%H\t%s\t%an",
           "--no-merges", "-20"], cd: path, stderr_to_stdout: true) do
      {output, 0} ->
        output
        |> String.split("\n", trim: true)
        |> Enum.map(fn line ->
          case String.split(line, "\t", parts: 3) do
            [hash, subject, author] -> %{hash: hash, subject: subject, author: author}
            _ -> nil
          end
        end)
        |> Enum.reject(&is_nil/1)
        |> Enum.filter(&notable_commit?/1)

      _ -> []
    end
  end

  defp notable_commit?(%{subject: subject}) do
    patterns = ~w(fixme hack todo workaround temporary revert breaking)
    downcased = String.downcase(subject)
    Enum.any?(patterns, &String.contains?(downcased, &1))
  end

  defp create_seeds(project, stale_branches, notable_commits) do
    stale_count = create_stale_branch_seed(project, stale_branches)
    notable_count = create_notable_commit_seed(project, notable_commits)
    stale_count + notable_count
  end

  defp create_stale_branch_seed(_project, []), do: 0
  defp create_stale_branch_seed(project, branches) do
    branch_list = Enum.map_join(branches, "\n", &"- #{&1.branch} (last: #{&1.last_commit})")

    case Proposals.create_seed(%{
      name: "Stale branches in #{project.name}",
      seed_type: "git",
      prompt_template: """
      The project "#{project.name}" has #{length(branches)} stale branches (no commits in #{@stale_branch_days}+ days):

      #{branch_list}

      Propose which branches should be deleted, merged, or preserved. Consider naming conventions and likely purpose.
      """,
      schedule: nil,
      active: true,
      project_id: project.id,
      metadata: %{source: "git_harvester", branch_count: length(branches)}
    }) do
      {:ok, _} -> 1
      {:error, _} -> 0
    end
  end

  defp create_notable_commit_seed(_project, []), do: 0
  defp create_notable_commit_seed(project, commits) do
    commit_list = Enum.map_join(commits, "\n", &"- #{String.slice(&1.hash, 0..7)}: #{&1.subject} (#{&1.author})")

    case Proposals.create_seed(%{
      name: "Notable commits in #{project.name}",
      seed_type: "git",
      prompt_template: """
      Recent commits in "#{project.name}" contain workarounds, TODOs, or other flags:

      #{commit_list}

      Propose follow-up tasks to address these. Prioritize by risk and effort.
      """,
      schedule: nil,
      active: true,
      project_id: project.id,
      metadata: %{source: "git_harvester", commit_count: length(commits)}
    }) do
      {:ok, _} -> 1
      {:error, _} -> 0
    end
  end
end
