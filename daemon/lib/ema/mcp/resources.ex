defmodule Ema.MCP.Resources do
  @moduledoc """
  MCP Resource handlers for EMA.

  Resources are read-only context that MCP clients can read to understand
  EMA's current state without taking action.
  """

  require Logger

  @base_url "http://localhost:4488"
  @request_timeout 30_000

  def list do
    [
      %{
        "uri" => "ema://context/operator",
        "name" => "Operator Context",
        "description" => "Canonical operator context package assembled by host EMA.",
        "mimeType" => "application/json"
      },
      %{
        "uri" => "ema://context/project",
        "name" => "Project Context Package",
        "description" => "Canonical project context package. Add ?id=<project_id_or_slug>.",
        "mimeType" => "application/json"
      },
      %{
        "uri" => "ema://projects/active",
        "name" => "Active Projects",
        "description" => "All active EMA projects with their goals, tasks, and recent activity.",
        "mimeType" => "application/json"
      },
      %{
        "uri" => "ema://tasks/pending",
        "name" => "Pending Tasks",
        "description" => "Tasks that are blocked or waiting for action, enriched with project and goal context.",
        "mimeType" => "application/json"
      },
      %{
        "uri" => "ema://proposals/recent",
        "name" => "Recent Approved Proposals",
        "description" => "The last 5 approved proposals — use these as quality examples when generating new proposals.",
        "mimeType" => "application/json"
      },
      %{
        "uri" => "ema://bootstrap/status",
        "name" => "Bootstrap Status",
        "description" => "Onboarding, provider, CLI tool, and active-use readiness for EMA.",
        "mimeType" => "application/json"
      },
      %{
        "uri" => "ema://focus/current",
        "name" => "Current Focus State",
        "description" => "Current focus session and timer state.",
        "mimeType" => "application/json"
      },
      %{
        "uri" => "ema://vault/search",
        "name" => "Vault Search",
        "description" => "Semantic search over the EMA knowledge vault. Add ?q=your+query to the URI.",
        "mimeType" => "application/json"
      },
      %{
        "uri" => "ema://intents/active",
        "name" => "Active Intents",
        "description" => "Active intents from the Intent Engine with context — the current semantic truth of what's in progress.",
        "mimeType" => "application/json"
      },
      %{
        "uri" => "ema://intents/tree",
        "name" => "Intent Tree",
        "description" => "Full intent hierarchy as a nested tree. Add ?project_id=X to filter by project.",
        "mimeType" => "application/json"
      }
    ]
  end

  def read("ema://context/operator") do
    fetch_resource("/api/context/operator/package", "context/operator")
  end

  def read("ema://context/project" <> query_string) do
    ref = parse_query_param(query_string, "id")

    cond do
      is_nil(ref) or ref == "" ->
        degraded_response("context/project", "Query parameter 'id' is required. Use ema://context/project?id=ema")

      true ->
        with {:ok, project_id} <- resolve_project_id(ref) do
          fetch_resource("/api/context/project/#{project_id}/package", "context/project")
        else
          _ -> degraded_response("context/project", "Project not found: #{ref}")
        end
    end
  end

  def read("ema://projects/active") do
    fetch_resource("/api/projects?status=active&include_context=true", "projects/active")
  end

  def read("ema://tasks/pending") do
    fetch_resource("/api/tasks?status=pending,blocked&include_context=true", "tasks/pending")
  end

  def read("ema://proposals/recent") do
    fetch_resource("/api/proposals?status=approved&limit=5&order=desc", "proposals/recent")
  end

  def read("ema://bootstrap/status") do
    fetch_resource("/api/onboarding/status", "bootstrap/status")
  end

  def read("ema://focus/current") do
    fetch_resource("/api/focus", "focus/current")
  end

  def read("ema://vault/search" <> query_string) do
    query = parse_query_param(query_string, "q")

    if query && query != "" do
      fetch_resource("/api/vectors/query?q=#{URI.encode(query)}&k=5", "vault/search")
    else
      degraded_response("vault/search", "Query parameter 'q' is required. Use ema://vault/search?q=your+query")
    end
  end

  def read("ema://intents/active") do
    fetch_resource("/api/intents?status=active&limit=20", "intents/active")
  end

  def read("ema://intents/tree" <> query_string) do
    project_id = parse_query_param(query_string, "project_id")

    path =
      if project_id && project_id != "" do
        "/api/intents/tree?project_id=#{URI.encode(project_id)}"
      else
        "/api/intents/tree"
      end

    fetch_resource(path, "intents/tree")
  end

  def read(uri) do
    Logger.warning("[MCP Resources] Unknown resource URI: #{uri}")
    degraded_response(uri, "Unknown resource URI: #{uri}")
  end

  defp resolve_project_id(ref) do
    url = @base_url <> "/api/projects"

    case Req.get(url, receive_timeout: @request_timeout, headers: [{"x-mcp-internal", "true"}]) do
      {:ok, %{status: 200, body: %{"projects" => projects}}} ->
        case Enum.find(projects, fn p -> ref in [p["id"], p["slug"], p["name"]] end) do
          nil -> {:error, :not_found}
          p -> {:ok, p["id"]}
        end

      _ -> {:error, :lookup_failed}
    end
  end

  defp fetch_resource(path, resource_name) do
    url = @base_url <> path

    case Req.get(url, receive_timeout: @request_timeout, headers: [{"x-mcp-internal", "true"}]) do
      {:ok, %{status: 200, body: body}} ->
        content = Jason.encode!(%{resource: resource_name, data: body, fetched_at: utc_now()})
        %{"contents" => [%{"uri" => "ema://#{resource_name}", "mimeType" => "application/json", "text" => content}]}

      {:ok, %{status: status}} ->
        Logger.warning("[MCP Resources] #{resource_name} returned HTTP #{status}")
        degraded_response(resource_name, "EMA API returned HTTP #{status}")

      {:error, reason} ->
        Logger.warning("[MCP Resources] #{resource_name} fetch error: #{inspect(reason)}")
        degraded_response(resource_name, "EMA API unavailable: #{inspect(reason)}")
    end
  end

  defp degraded_response(resource_name, message) do
    content = Jason.encode!(%{resource: resource_name, degraded: true, message: message, data: [], fetched_at: utc_now()})
    %{"contents" => [%{"uri" => "ema://#{resource_name}", "mimeType" => "application/json", "text" => content}]}
  end

  defp parse_query_param(query_string, param) do
    query_string |> String.trim_leading("?") |> URI.decode_query() |> Map.get(param)
  end

  defp utc_now, do: DateTime.utc_now() |> DateTime.to_iso8601()
end
