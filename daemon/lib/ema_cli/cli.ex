defmodule EmaCli.CLI do
  @moduledoc "EMA CLI — mirrors all EMA features via HTTP API"

  def main(args) do
    case parse(args) do
      {:ok, feature, subcommand, opts} -> dispatch(feature, subcommand, opts)
      {:error, msg} -> error(msg)
    end
  end

  defp parse([feature | [subcommand | rest]]) do
    opts = parse_opts(rest)
    {:ok, feature, subcommand, opts}
  end

  defp parse([feature]) when feature not in ["--help", "-h"] do
    {:ok, feature, "help", %{}}
  end

  defp parse(_), do: {:ok, "help", "all", %{}}

  defp dispatch("intent", sub, opts), do: EmaCli.Intent.run(sub, opts)
  defp dispatch("proposal", sub, opts), do: EmaCli.Proposal.run(sub, opts)
  defp dispatch("session", sub, opts), do: EmaCli.Session.run(sub, opts)
  defp dispatch("quality", sub, opts), do: EmaCli.Quality.run(sub, opts)
  defp dispatch("routing", sub, opts), do: EmaCli.Routing.run(sub, opts)
  defp dispatch("health", sub, opts), do: EmaCli.Health.run(sub, opts)
  defp dispatch("test", sub, opts), do: EmaCli.TestRunner.run(sub, opts)
  defp dispatch(_, _, _), do: print_help()

  def parse_opts(args) do
    Enum.reduce(args, %{}, fn arg, acc ->
      cond do
        String.starts_with?(arg, "--") ->
          case String.split(arg, "=", parts: 2) do
            ["--" <> key, val] -> Map.put(acc, String.to_atom(key), val)
            ["--" <> key] -> Map.put(acc, String.to_atom(key), true)
          end

        not String.starts_with?(arg, "-") ->
          Map.put(acc, :_arg, arg)

        true ->
          acc
      end
    end)
  end

  def api_get(path) do
    base = System.get_env("EMA_API_URL", "http://localhost:4488/api")

    case Req.get("#{base}#{path}", receive_timeout: 10_000) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: s, body: b}} -> {:error, "HTTP #{s}: #{inspect(b)}"}
      {:error, reason} -> {:error, inspect(reason)}
    end
  end

  def api_post(path, body) do
    base = System.get_env("EMA_API_URL", "http://localhost:4488/api")

    case Req.post("#{base}#{path}", json: body, receive_timeout: 30_000) do
      {:ok, %{status: s, body: b}} when s in [200, 201] -> {:ok, b}
      {:ok, %{status: s, body: b}} -> {:error, "HTTP #{s}: #{inspect(b)}"}
      {:error, reason} -> {:error, inspect(reason)}
    end
  end

  def format_output(data, opts) do
    case Map.get(opts, :format, "table") do
      "json" -> IO.puts(Jason.encode!(data, pretty: true))
      "csv" -> print_csv(data)
      _ -> print_table(data)
    end
  end

  defp print_table([]), do: IO.puts("(no results)")

  defp print_table(data) when is_list(data) do
    first = hd(data)

    keys =
      Map.keys(first)
      |> Enum.reject(&(&1 == :__struct__))
      |> Enum.map(&to_string/1)
      |> Enum.sort()
      |> Enum.take(6)

    header = Enum.map_join(keys, " | ", &String.pad_trailing(&1, 18))
    IO.puts("\n#{header}")
    IO.puts(String.duplicate("-", String.length(header)))

    Enum.each(data, fn row ->
      line =
        Enum.map_join(keys, " | ", fn k ->
          val =
            (Map.get(row, k) || Map.get(row, String.to_existing_atom(k), ""))
            |> to_string()
            |> String.slice(0, 18)

          String.pad_trailing(val, 18)
        end)

      IO.puts(line)
    end)

    IO.puts("")
  end

  defp print_table(data), do: IO.inspect(data, pretty: true)

  defp print_csv([]), do: IO.puts("(no data)")

  defp print_csv(data) when is_list(data) do
    keys = Map.keys(hd(data)) |> Enum.map(&to_string/1) |> Enum.sort()
    IO.puts(Enum.join(keys, ","))

    Enum.each(data, fn row ->
      IO.puts(Enum.map_join(keys, ",", fn k -> ~s("#{Map.get(row, k, "")}") end))
    end)
  end

  def error(msg) do
    IO.puts(:stderr, "\e[31mError: #{msg}\e[0m")
    System.halt(1)
  end

  def success(msg), do: IO.puts("\e[32m#{msg}\e[0m")
  def warn(msg), do: IO.puts("\e[33m#{msg}\e[0m")

  defp print_help do
    IO.puts("""

    EMA CLI -- Executive Management Assistant
    ------------------------------------------

    USAGE: ema <feature> <subcommand> [options]

    FEATURES:
      intent    search, graph, list, trace
      proposal  list, show, validate, approve, reject, generate, genealogy
      session   state, list, crystallize, export
      quality   report, friction, gradient, budget, threats, improve
      routing   status, fitness, dispatch
      health    dashboard, check
      test      run [--suite=unit|integration|ai|stress|all]

    OPTIONS:
      --format=table|json|csv   Output format
      --limit=N                 Limit results
      --project=<id>            Filter by project
      --days=N                  Time window (days)

    EXAMPLES:
      ema proposal list --status=pending --format=json
      ema intent search "rate limiting" --project=execudeck
      ema quality report --days=7
      ema test run --suite=all --output=/tmp/test-report.json
      ema health check
    """)
  end
end
