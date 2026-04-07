defmodule Ema.CLI.Commands.Health do
  @moduledoc "Comprehensive system health check — verify all EMA subsystems."

  alias Ema.CLI.Output

  @vault_path "~/.local/share/ema/vault/"
  @db_path "~/.local/share/ema/ema.db"

  def handle([], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        checks = run_all_checks(transport)

        if opts[:json] do
          Output.json(checks)
        else
          print_health(checks)
        end

      Ema.CLI.Transport.Http ->
        checks = run_http_checks(transport)

        if opts[:json] do
          Output.json(checks)
        else
          print_health(checks)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown health subcommand: #{inspect(sub)}")
  end

  defp run_all_checks(transport) do
    checks = [
      check_daemon(transport),
      check_db(),
      check_claude_cli(),
      check_bridge(),
      check_engine(transport),
      check_vault(),
      check_agents(transport),
      check_tables(),
      check_memory()
    ]

    all_ok = Enum.all?(checks, fn {_name, status, _detail} -> status == :ok end)
    {checks, all_ok}
  end

  defp run_http_checks(transport) do
    daemon_check =
      case transport.get("/health") do
        {:ok, _} -> {"Daemon", :ok, "reachable at localhost:4488"}
        {:error, reason} -> {"Daemon", :error, "unreachable: #{inspect(reason)}"}
      end

    claude_check = check_claude_cli()
    vault_check = check_vault()
    db_check = check_db_file()

    checks = [daemon_check, db_check, claude_check, vault_check]
    all_ok = Enum.all?(checks, fn {_name, status, _detail} -> status == :ok end)
    {checks, all_ok}
  end

  defp check_daemon(transport) do
    case transport.call(Ema.Repo, :query, ["SELECT 1"]) do
      {:ok, _} -> {"Daemon", :ok, "running (PID #{System.pid()})"}
      _ -> {"Daemon", :warn, "running but DB query failed"}
    end
  end

  defp check_db do
    path = Path.expand(@db_path)

    cond do
      not File.exists?(path) ->
        {"Database", :error, "not found at #{path}"}

      true ->
        case File.stat(path) do
          {:ok, %{size: size}} ->
            size_mb = Float.round(size / 1_048_576, 1)
            {"Database", :ok, "#{size_mb} MB at #{path}"}

          {:error, reason} ->
            {"Database", :error, "stat failed: #{reason}"}
        end
    end
  end

  defp check_db_file do
    path = Path.expand(@db_path)

    if File.exists?(path) do
      {:ok, %{size: size}} = File.stat(path)
      size_mb = Float.round(size / 1_048_576, 1)
      {"Database", :ok, "#{size_mb} MB"}
    else
      {"Database", :error, "not found"}
    end
  end

  defp check_claude_cli do
    if System.find_executable("claude") do
      {"Claude CLI", :ok, "found at #{System.find_executable("claude")}"}
    else
      {"Claude CLI", :warn, "not in PATH"}
    end
  end

  defp check_bridge do
    try do
      case Process.whereis(Ema.Bridge.Supervisor) do
        nil -> {"AI Bridge", :warn, "supervisor not running"}
        pid -> {"AI Bridge", :ok, "running (PID #{inspect(pid)})"}
      end
    rescue
      _ -> {"AI Bridge", :warn, "check failed"}
    end
  end

  defp check_engine(transport) do
    try do
      case transport.call(Ema.ProposalEngine.Scheduler, :status, []) do
        {:ok, status} ->
          if status[:paused] do
            {"Engine", :warn, "paused"}
          else
            {"Engine", :ok, "running"}
          end

        _ ->
          {"Engine", :warn, "status unknown"}
      end
    rescue
      _ -> {"Engine", :error, "not responding"}
    catch
      :exit, _ -> {"Engine", :error, "not responding"}
    end
  end

  defp check_vault do
    path = Path.expand(@vault_path)

    cond do
      not File.exists?(path) ->
        {"Vault", :error, "not found at #{path}"}

      not File.dir?(path) ->
        {"Vault", :error, "exists but is not a directory"}

      true ->
        # Check writable
        test_file = Path.join(path, ".ema_health_check")

        case File.write(test_file, "ok") do
          :ok ->
            File.rm(test_file)
            {"Vault", :ok, "writable at #{path}"}

          {:error, reason} ->
            {"Vault", :error, "not writable: #{reason}"}
        end
    end
  end

  defp check_agents(transport) do
    case transport.call(Ema.Agents, :list_active_agents, []) do
      {:ok, agents} -> {"Agents", :ok, "#{length(agents)} active"}
      _ -> {"Agents", :warn, "could not list agents"}
    end
  end

  defp check_tables do
    tables = [
      {"tasks", Ema.Tasks.Task},
      {"proposals", Ema.Proposals.Proposal},
      {"executions", Ema.Executions.Execution},
      {"brain_dump", Ema.BrainDump.Item},
      {"goals", Ema.Goals.Goal},
      {"agents", Ema.Agents.Agent}
    ]

    counts =
      Enum.map(tables, fn {name, schema} ->
        try do
          count = Ema.Repo.aggregate(schema, :count)
          {name, count}
        rescue
          _ -> {name, -1}
        end
      end)

    failed = Enum.filter(counts, fn {_, c} -> c == -1 end)

    if failed == [] do
      detail =
        counts
        |> Enum.map(fn {name, count} -> "#{name}=#{count}" end)
        |> Enum.join(", ")

      {"Tables", :ok, detail}
    else
      {"Tables", :warn, "#{length(failed)} table(s) unreachable"}
    end
  end

  defp check_memory do
    try do
      mem = :erlang.memory()
      total_mb = Float.round(mem[:total] / 1_048_576, 1)
      proc_mb = Float.round(mem[:processes] / 1_048_576, 1)

      status = if total_mb > 500, do: :warn, else: :ok
      {
        "Memory",
        status,
        "#{total_mb} MB total, #{proc_mb} MB processes"
      }
    rescue
      _ -> {"Memory", :warn, "could not read"}
    end
  end

  defp print_health({checks, all_ok}) do
    IO.puts("")
    IO.puts("#{IO.ANSI.bright()}#{IO.ANSI.cyan()}  EMA Health Check#{IO.ANSI.reset()}")
    IO.puts("  #{String.duplicate("─", 50)}")
    IO.puts("")

    Enum.each(checks, fn {name, status, detail} ->
      icon = status_icon(status)
      padded = String.pad_trailing(name, 14)
      IO.puts("    #{icon} #{padded} #{IO.ANSI.faint()}#{detail}#{IO.ANSI.reset()}")
    end)

    IO.puts("")

    if all_ok do
      IO.puts("  #{IO.ANSI.green()}All systems healthy#{IO.ANSI.reset()}")
    else
      error_count =
        Enum.count(checks, fn {_, s, _} -> s == :error end)

      warn_count =
        Enum.count(checks, fn {_, s, _} -> s == :warn end)

      parts = []
      parts = if error_count > 0, do: ["#{IO.ANSI.red()}#{error_count} error(s)#{IO.ANSI.reset()}" | parts], else: parts
      parts = if warn_count > 0, do: ["#{IO.ANSI.yellow()}#{warn_count} warning(s)#{IO.ANSI.reset()}" | parts], else: parts

      IO.puts("  #{Enum.join(Enum.reverse(parts), ", ")}")
    end

    IO.puts("")
  end

  defp status_icon(:ok), do: "#{IO.ANSI.green()}✓#{IO.ANSI.reset()}"
  defp status_icon(:warn), do: "#{IO.ANSI.yellow()}!#{IO.ANSI.reset()}"
  defp status_icon(:error), do: "#{IO.ANSI.red()}✗#{IO.ANSI.reset()}"
end
