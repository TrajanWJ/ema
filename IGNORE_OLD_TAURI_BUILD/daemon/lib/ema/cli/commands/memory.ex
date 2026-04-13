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

  # ── Typed memory entries (Sugar-style) ──────────────────────────────────

  def handle([:store], parsed, transport, opts) do
    body =
      %{
        "type" => parsed.options[:type] || "decision",
        "content" => parsed.args[:content] || parsed.options[:content],
        "scope" => parsed.options[:scope] || "project",
        "importance" => parse_float(parsed.options[:importance]) || 1.0
      }
      |> Enum.reject(fn {_k, v} -> is_nil(v) or v == "" end)
      |> Map.new()

    case transport.post("/memory/entries", json: body) do
      {:ok, entry} -> if opts[:json], do: Output.json(entry), else: Output.detail(entry)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:recall], parsed, transport, opts) do
    query = parsed.args[:query] || parsed.options[:query] || ""

    case transport.get("/memory/entries/search", params: [q: query]) do
      {:ok, body} ->
        results = Helpers.extract_list(body, "results")

        cols = [
          {"Type", "memory_type"},
          {"Score", "score"},
          {"Importance", "importance"},
          {"Content", "content"}
        ]

        Output.render(results, cols, json: opts[:json])

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:list], parsed, transport, opts) do
    params =
      [limit: parsed.options[:limit], type: parsed.options[:type]]
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)

    case transport.get("/memory/entries/recent", params: params) do
      {:ok, body} ->
        entries = Helpers.extract_list(body, "entries")

        cols = [
          {"ID", "id"},
          {"Type", "memory_type"},
          {"Scope", "scope"},
          {"Importance", "importance"},
          {"Content", "content"}
        ]

        Output.render(entries, cols, json: opts[:json])

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:"context-bundle"], parsed, transport, opts) do
    params =
      [actor_id: parsed.options[:actor], project_id: parsed.options[:project]]
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)

    case transport.get("/memory/entries/context", params: params) do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown memory subcommand: #{inspect(sub)}")
  end

  defp parse_float(nil), do: nil
  defp parse_float(n) when is_number(n), do: n * 1.0

  defp parse_float(s) when is_binary(s) do
    case Float.parse(s) do
      {f, _} -> f
      :error -> nil
    end
  end
end
