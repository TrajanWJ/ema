defmodule Ema.CLI.Commands.Schema do
  @moduledoc """
  Introspect EMA REST endpoints (and CLI commands).

  Designed for agents that need to discover EMA's API surface without
  parsing router source. Uses Phoenix's compiled `__routes__/0` for truth.

      ema schema list                # all routes
      ema schema list --json         # machine-readable
      ema schema show /api/tasks     # filter routes by path substring
  """

  alias Ema.CLI.Output

  def handle([:list], _parsed, _transport, opts) do
    routes = collect_routes()

    if opts[:json] do
      Output.json(Enum.map(routes, &route_to_map/1))
    else
      print_routes(routes)
    end
  end

  def handle([:show], parsed, _transport, opts) do
    endpoint = parsed.args[:endpoint] || ""

    matching =
      collect_routes()
      |> Enum.filter(fn r -> String.contains?(r.path, endpoint) end)

    if matching == [] do
      Output.error("No routes match '#{endpoint}'")
      System.halt(1)
    end

    if opts[:json] do
      Output.json(Enum.map(matching, &route_to_map/1))
    else
      print_route_details(matching)
    end
  end

  def handle([], parsed, transport, opts) do
    handle([:list], parsed, transport, opts)
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown schema subcommand: #{inspect(sub)}")
    System.halt(1)
  end

  # ── Internals ───────────────────────────────────────────────────────────

  defp collect_routes do
    EmaWeb.Router.__routes__()
    |> Enum.sort_by(fn r -> {r.path, verb_string(r.verb)} end)
  end

  defp route_to_map(route) do
    %{
      verb: verb_string(route.verb),
      path: route.path,
      controller: inspect(route.plug),
      action: route.plug_opts,
      helper: route.helper
    }
  end

  defp verb_string(verb) when is_atom(verb), do: verb |> Atom.to_string() |> String.upcase()
  defp verb_string(other), do: to_string(other)

  defp print_routes(routes) do
    IO.puts("")
    IO.puts("#{IO.ANSI.bright()}#{IO.ANSI.cyan()}  EMA API Schema — #{length(routes)} route(s)#{IO.ANSI.reset()}")
    IO.puts("  #{String.duplicate("─", 70)}")

    Enum.each(routes, fn route ->
      verb = String.pad_trailing(verb_string(route.verb), 7)
      path = String.pad_trailing(route.path, 50)
      action = route.plug_opts
      IO.puts("  #{IO.ANSI.green()}#{verb}#{IO.ANSI.reset()} #{path} #{IO.ANSI.faint()}##{action}#{IO.ANSI.reset()}")
    end)

    IO.puts("")
  end

  defp print_route_details(routes) do
    IO.puts("")

    Enum.each(routes, fn route ->
      IO.puts("  #{IO.ANSI.bright()}#{verb_string(route.verb)} #{route.path}#{IO.ANSI.reset()}")
      IO.puts("    Controller: #{inspect(route.plug)}")
      IO.puts("    Action:     #{route.plug_opts}")
      if route.helper, do: IO.puts("    Helper:     #{route.helper}_path")
      IO.puts("")
    end)
  end
end
