defmodule Ema.Integrations.Slack.Bot do
  @moduledoc "Handles /ema slash commands from Slack."

  alias Ema.Tasks
  alias Ema.Proposals
  alias Ema.Projects

  def handle_command("status", _params) do
    executions = Ema.Executions.list_executions(status: "running")
    count = length(executions)

    lines =
      executions
      |> Enum.take(10)
      |> Enum.map(fn e -> "• #{e.title || e.id} — #{e.status}" end)

    %{
      response_type: "ephemeral",
      blocks: [
        section("*Active Executions (#{count})*"),
        section(Enum.join(lines, "\n") |> fallback("No active executions."))
      ]
    }
  end

  def handle_command("task", %{"text" => text}) when text != "" do
    case Tasks.create_task(%{title: text, status: "todo", source: "slack"}) do
      {:ok, task} ->
        %{response_type: "in_channel", blocks: [section("Task created: *#{task.title}*")]}

      {:needs_deliberation, _} ->
        %{response_type: "ephemeral", blocks: [section("Task sent to deliberation gate.")]}

      {:requires_proposal, _} ->
        %{response_type: "ephemeral", blocks: [section("Task requires a proposal first.")]}

      {:error, _} ->
        %{response_type: "ephemeral", blocks: [section("Failed to create task.")]}
    end
  end

  def handle_command("proposal", %{"text" => text}) when text != "" do
    case Proposals.create_proposal(%{title: text, status: "queued", source: "slack"}) do
      {:ok, proposal} ->
        %{response_type: "in_channel", blocks: [section("Proposal created: *#{proposal.title}*")]}

      {:error, _} ->
        %{response_type: "ephemeral", blocks: [section("Failed to create proposal.")]}
    end
  end

  def handle_command("projects", _params) do
    projects = Projects.list_by_status("active")

    lines =
      projects
      |> Enum.map(fn p -> "• *#{p.name}* (#{p.slug})" end)

    %{
      response_type: "ephemeral",
      blocks: [
        section("*Active Projects (#{length(projects)})*"),
        section(Enum.join(lines, "\n") |> fallback("No active projects."))
      ]
    }
  end

  def handle_command(unknown, _params) do
    %{
      response_type: "ephemeral",
      blocks: [
        section("Unknown command: `#{unknown}`\nAvailable: `status`, `task <text>`, `proposal <text>`, `projects`")
      ]
    }
  end

  defp section(text), do: %{type: "section", text: %{type: "mrkdwn", text: text}}

  defp fallback("", default), do: default
  defp fallback(text, _default), do: text
end
