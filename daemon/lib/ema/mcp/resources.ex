defmodule Ema.MCP.Resources do
  @moduledoc """
  MCP Resource handlers for EMA.

  Resources are read-only context that MCP clients (Claude Code) can
  read to understand EMA's current state without taking action.

  Resources are fetched from the EMA daemon REST API at localhost:4000.
  If a resource fetch fails, we return a graceful degraded response
  rather than propagating the error up.

  Registered resources:
    ema://projects/active      → Active projects with goals + tasks
    ema://tasks/pending        → Pending/blocked tasks with context
    ema://proposals/recent     → Last 5 approved proposals (quality examples)
    ema://vault/search?q=QUERY → Semantic vault search
    ema://goals/active         → Active goals with progress
    ema://patterns/recent      → Recent successful patterns
  """

  require Logger

  @base_url "http://localhost:4000"
  @request_timeout 30_000

  # ── Resource Registry ─────────────────────────────────────────────────────

  @doc """
  Returns the MCP resource list descriptor for all registered resources.
  """
  def list do
    [
      %{
        "uri" => "ema://projects/active",
        "name" => "Active Projects",
        "description" =>
          "All active EMA projects with their goals, tasks, and recent activity. Use this to understand what work is in flight.",
        "mimeType" => "application/json"
      },
      %{
        "uri" => "ema://tasks/pending",
        "name" => "Pending Tasks",
        "description" =>
          "Tasks that are blocked or waiting for action, enriched with project and goal context. Use this to find work that needs attention.",
        "mimeType" => "application/json"
      },
      %{
        "uri" => "ema://proposals/recent",
        "name" => "Recent Approved Proposals",
        "description" =>
          "The last 5 approved proposals — use these as quality examples when generating new proposals.",
        "mimeType" => "application/json"
      },
      %{
        "uri" => "ema://vault/search",
        "name" => "Vault Search",
        "description" =>
          "Semantic search over the EMA knowledge vault. Add ?q=your+query to the URI. Returns top 5 relevant notes with snippets.",
        "mimeType" => "application/json"
      },
      %{
        "uri" => "ema://goals/active",
        "name" => "Active Goals",
        "description" =>
          "All active goals with progress percentages, blockers, and related tasks.",
        "mimeType" => "application/json"
      },
      %{
        "uri" => "ema://patterns/recent",
        "name" => "Recent Patterns",
        "description" =>
          "Recently detected successful patterns from the outcome tracker. Use these to inform how you structure new work.",
        "mimeType" => "application/json"
      }
    ]
  end

  # ── Resource Read ─────────────────────────────────────────────────────────

  @doc """
  Fetch a resource by URI and return MCP-formatted content.
  Returns a map with "contents" key containing a list of content items.
  """
  def read("ema://projects/active") do
    fetch_resource("/api/projects?status=active&include_context=true", "projects/active")
  end

  def read("ema://tasks/pending") do
    fetch_resource("/api/tasks?status=pending,blocked&include_context=true", "tasks/pending")
  end

  def read("ema://proposals/recent") do
    fetch_resource("/api/proposals?status=approved&limit=5&order=desc", "proposals/recent")
  end

  def read("ema://goals/active") do
    fetch_resource("/api/goals?status=active&include_progress=true", "goals/active")
  end

  def read("ema://patterns/recent") do
    fetch_resource("/api/intelligence/patterns?type=success&limit=10", "patterns/recent")
  end

  def read("ema://vault/search" <> query_string) do
    # Parse query param from ?q=...
    query = parse_query_param(query_string, "q")

    if query && query != "" do
      fetch_resource(
        "/api/vectors/search?query=#{URI.encode(query)}&limit=5",
        "vault/search"
      )
    else
      degraded_response(
        "vault/search",
        "Query parameter 'q' is required. Use ema://vault/search?q=your+query"
      )
    end
  end

  def read(uri) do
    Logger.warning("[MCP Resources] Unknown resource URI: #{uri}")
    degraded_response(uri, "Unknown resource URI: #{uri}")
  end

  # ── Private: HTTP Fetcher ─────────────────────────────────────────────────

  defp fetch_resource(path, resource_name) do
    url = @base_url <> path

    Logger.debug("[MCP Resources] Fetching: #{url}")

    case Req.get(url,
           receive_timeout: @request_timeout,
           headers: [{"x-mcp-internal", "true"}]
         ) do
      {:ok, %{status: 200, body: body}} ->
        content = Jason.encode!(%{resource: resource_name, data: body, fetched_at: utc_now()})

        %{
          "contents" => [
            %{
              "uri" => "ema://#{resource_name}",
              "mimeType" => "application/json",
              "text" => content
            }
          ]
        }

      {:ok, %{status: status}} ->
        Logger.warning("[MCP Resources] #{resource_name} returned HTTP #{status}")
        degraded_response(resource_name, "EMA API returned HTTP #{status}")

      {:error, reason} ->
        Logger.warning("[MCP Resources] #{resource_name} fetch error: #{inspect(reason)}")
        degraded_response(resource_name, "EMA API unavailable: #{inspect(reason)}")
    end
  end

  defp degraded_response(resource_name, message) do
    content =
      Jason.encode!(%{
        resource: resource_name,
        degraded: true,
        message: message,
        data: [],
        fetched_at: utc_now()
      })

    %{
      "contents" => [
        %{
          "uri" => "ema://#{resource_name}",
          "mimeType" => "application/json",
          "text" => content
        }
      ]
    }
  end

  defp parse_query_param(query_string, param) do
    # query_string is like "?q=foo+bar" or "?q=foo%20bar"
    query_string
    |> String.trim_leading("?")
    |> URI.decode_query()
    |> Map.get(param)
  end

  defp utc_now do
    DateTime.utc_now() |> DateTime.to_iso8601()
  end
end
