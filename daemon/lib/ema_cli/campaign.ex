defmodule EmaCli.Campaign do
  @moduledoc "CLI commands for Campaign workflows"

  import EmaCli.CLI, only: [api_get: 1, api_post: 2, format_output: 2, error: 1, success: 1]

  def run("list", opts) do
    case api_get("/campaigns") do
      {:ok, %{"campaigns" => campaigns}} -> format_output(campaigns, opts)
      {:ok, campaigns} when is_list(campaigns) -> format_output(campaigns, opts)
      {:error, msg} -> error(msg)
    end
  end

  def run("show", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema campaign show <id>")

    case api_get("/campaigns/#{id}") do
      {:ok, campaign} when is_map(campaign) ->
        IO.puts("\n\e[1mCampaign: #{campaign["name"] || id}\e[0m")
        IO.puts("  ID:        #{campaign["id"]}")
        IO.puts("  Status:    #{campaign["status"] || "unknown"}")
        IO.puts("  Project:   #{campaign["project_id"] || "none"}")
        IO.puts("  Run Count: #{campaign["run_count"] || 0}")
        IO.puts("  Updated:   #{campaign["updated_at"] || "n/a"}")

      {:error, msg} ->
        error(msg)
    end
  end

  def run("create", opts) do
    name = Map.get(opts, :_arg) || error("Usage: ema campaign create <name>")
    project_id = Map.get(opts, :project)

    attrs = %{campaign: %{name: name}}
    attrs = if project_id, do: put_in(attrs, [:campaign, :project_id], project_id), else: attrs

    case api_post("/campaigns", attrs) do
      {:ok, campaign} -> success("Created campaign #{campaign["id"]}: #{name}")
      {:error, msg} -> error(msg)
    end
  end

  def run("run", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema campaign run <id>")

    case api_post("/campaigns/#{id}/run", %{}) do
      {:ok, run} -> success("Started run #{run["id"] || "ok"} for campaign #{id}")
      {:error, msg} -> error(msg)
    end
  end

  def run("advance", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema campaign advance <id>")
    status = Map.get(opts, :status)
    body = if status, do: %{status: status}, else: %{}

    case api_post("/campaigns/#{id}/advance", body) do
      {:ok, _} -> success("Campaign #{id} advanced")
      {:error, msg} -> error(msg)
    end
  end

  def run("runs", opts) do
    id = Map.get(opts, :_arg) || error("Usage: ema campaign runs <id>")

    case api_get("/campaigns/#{id}/runs") do
      {:ok, %{"runs" => runs}} -> format_output(runs, opts)
      {:ok, runs} when is_list(runs) -> format_output(runs, opts)
      {:error, msg} -> error(msg)
    end
  end

  def run(unknown, _),
    do: error("Unknown campaign subcommand: #{unknown}. Try: list, show, create, run, advance, runs")
end
