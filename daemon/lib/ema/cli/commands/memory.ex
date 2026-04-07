defmodule Ema.CLI.Commands.Memory do
  @moduledoc "CLI commands for session memory — list sessions, fragments, search."

  alias Ema.CLI.{Helpers, Output}

  def handle([:sessions], _parsed, transport, opts) do
    case transport.get("/memory/sessions") do
      {:ok, body} ->
        sessions = Helpers.extract_list(body, "sessions")

        cols = [
          {"ID", "id"},
          {"Project", "project_path"},
          {"Status", "status"},
          {"Tokens", "token_count"}
        ]

        Output.render(sessions, cols, json: opts[:json])

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:fragments], _parsed, transport, opts) do
    case transport.get("/memory/fragments") do
      {:ok, body} ->
        fragments = Helpers.extract_list(body, "fragments")

        cols = [
          {"ID", "id"},
          {"Type", "fragment_type"},
          {"Score", "importance_score"},
          {"Content", "content"}
        ]

        Output.render(fragments, cols, json: opts[:json])

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:context], parsed, transport, opts) do
    params = Helpers.compact_keyword(project_path: parsed.options[:project])

    case transport.get("/memory/context", params: params) do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:search], parsed, transport, opts) do
    query = parsed.args[:query] || parsed.options[:query] || ""

    case transport.get("/memory/search", params: [q: query]) do
      {:ok, body} ->
        sessions = Helpers.extract_list(body, "sessions")

        cols = [
          {"ID", "id"},
          {"Project", "project_path"},
          {"Status", "status"},
          {"Tokens", "token_count"}
        ]

        Output.render(sessions, cols, json: opts[:json])

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown memory subcommand: #{inspect(sub)}")
  end
end
