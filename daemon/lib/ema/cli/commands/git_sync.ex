defmodule Ema.CLI.Commands.GitSync do
  @moduledoc "CLI commands for git intelligence."

  alias Ema.CLI.{Helpers, Output}

  @columns [{"ID", :id}, {"Type", :type}, {"Repo", :repo}, {"Created", :inserted_at}]

  def handle([:events], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/intelligence/git-events") do
      {:ok, body} -> Output.render(Helpers.extract_list(body, "events"), @columns, json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:sync_status], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/intelligence/sync-status") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:scan], _parsed, _transport, _opts) do
    case Ema.CLI.Transport.Http.post("/intelligence/git-events/scan") do
      {:ok, _} -> Output.success("Git scan triggered")
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:suggestions], parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/intelligence/git-events/#{parsed.args.id}/suggestions") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown git-sync subcommand: #{inspect(sub)}")
  end
end
