defmodule Ema.CLI.Commands.AiSession do
  @moduledoc "CLI commands for AI streaming sessions."

  alias Ema.CLI.{Helpers, Output}

  @columns [{"ID", :id}, {"Status", :status}, {"Model", :model}, {"Updated", :updated_at}]

  def handle([:list], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/ai-sessions") do
      {:ok, body} -> Output.render(Helpers.extract_list(body, "sessions"), @columns, json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:show], parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/ai-sessions/#{parsed.args.id}") do
      {:ok, body} -> Output.detail(Helpers.extract_record(body, "session"), json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:create], parsed, _transport, opts) do
    body = Helpers.compact_map([
      {"model", parsed.options[:model]},
      {"project_slug", parsed.options[:project]}
    ])

    case Ema.CLI.Transport.Http.post("/ai-sessions", body) do
      {:ok, resp} ->
        s = Helpers.extract_record(resp, "session")
        Output.success("Created AI session #{s["id"]}")
        if opts[:json], do: Output.json(s)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:resume], parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.post("/ai-sessions/#{parsed.args.id}/resume") do
      {:ok, resp} ->
        Output.success("Resumed AI session #{parsed.args.id}")
        if opts[:json], do: Output.json(resp)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:fork], parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.post("/ai-sessions/#{parsed.args.id}/fork") do
      {:ok, resp} ->
        Output.success("Forked AI session #{parsed.args.id}")
        if opts[:json], do: Output.json(resp)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown ai-session subcommand: #{inspect(sub)}")
  end
end
