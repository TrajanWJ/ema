defmodule EmaCli.Health do
  @moduledoc "CLI commands for System Health"

  import EmaCli.CLI, only: [api_get: 1, error: 1]

  def run("dashboard", _opts) do
    IO.puts("""

    ================================================
           EMA System Health Dashboard
    ================================================
    """)

    check_and_print("Daemon API", fn -> api_get("/settings") end)
    check_and_print("Tasks", fn -> api_get("/tasks?limit=1") end)
    check_and_print("Proposals", fn -> api_get("/proposals?limit=1") end)
    check_and_print("Intent Graph", fn -> api_get("/intent/nodes?limit=1") end)
    check_and_print("Quality (F4)", fn -> api_get("/quality/friction") end)
    check_and_print("Orchestration (F5)", fn -> api_get("/orchestration/stats") end)
    check_and_print("Session Store (F3)", fn -> api_get("/context") end)
    IO.puts("")
  end

  def run("check", _opts) do
    IO.puts("\nEMA Health Check:")

    checks = [
      {"Daemon API", fn -> api_get("/settings") end},
      {"Tasks API", fn -> api_get("/tasks?limit=1") end},
      {"Proposals API", fn -> api_get("/proposals?limit=1") end},
      {"Intent nodes API", fn -> api_get("/intent/nodes?limit=1") end},
      {"Quality API (F4)", fn -> api_get("/quality/friction") end},
      {"Orchestration (F5)", fn -> api_get("/orchestration/stats") end},
      {"Session Store (F3)", fn -> api_get("/context") end},
      {"Superman", fn -> api_get("/superman/status") end}
    ]

    results =
      Enum.map(checks, fn {name, fun} ->
        result =
          try do
            case fun.() do
              {:ok, _} -> {:ok, "OK"}
              {:error, msg} -> {:error, msg}
            end
          rescue
            e -> {:error, Exception.message(e)}
          end

        {name, result}
      end)

    Enum.each(results, fn {name, result} ->
      case result do
        {:ok, _} ->
          IO.puts("  \e[32m+\e[0m #{String.pad_trailing(name, 25)} OK")

        {:error, msg} ->
          IO.puts(
            "  \e[31mx\e[0m #{String.pad_trailing(name, 25)} #{String.slice(to_string(msg), 0, 50)}"
          )
      end
    end)

    failed = Enum.count(results, fn {_, {s, _}} -> s == :error end)
    IO.puts("\n#{length(results) - failed}/#{length(results)} checks passed\n")
  end

  def run(unknown, _),
    do: error("Unknown health subcommand: #{unknown}. Try: dashboard, check")

  defp check_and_print(name, fun) do
    result =
      try do
        case fun.() do
          {:ok, _} -> "\e[32m* online\e[0m"
          {:error, _} -> "\e[33mo not deployed\e[0m"
        end
      rescue
        _ -> "\e[31m* error\e[0m"
      end

    IO.puts("  #{String.pad_trailing(name, 25)} #{result}")
  end
end
