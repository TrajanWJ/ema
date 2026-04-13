defmodule Ema.CLI.Commands.Doctor do
  @moduledoc """
  Diagnostic health check for EMA daemon and dependencies.

  Comprehensive 15-check system audit covering DB pragmas, supervisors,
  external CLIs, vault writability, OTP memory, and current workload.
  Exits non-zero on any failed check so it can wire into shell pipelines.
  """

  alias Ema.CLI.Output

  @vault_path "~/.local/share/ema/vault/"
  @memory_warn_mb 500

  def handle([], _parsed, _transport, opts) do
    checks = [
      {"Daemon health", check_daemon()},
      {"Database connection", check_db()},
      {"SQLite WAL mode", check_wal_mode()},
      {"Foreign keys enabled", check_foreign_keys()},
      {"Migration state", check_migrations()},
      {"Claude CLI available", check_claude_cli()},
      {"Bridge supervisor", check_bridge()},
      {"Proposal Engine", check_engine()},
      {"Babysitter", check_babysitter()},
      {"Vault writable", check_vault()},
      {"PubSub subscriber count", check_pubsub()},
      {"Memory usage", check_memory()},
      {"Active executions", check_executions()},
      {"Queued proposals", check_proposals()},
      {"Disk space", check_disk()}
    ]

    if opts[:json] do
      Output.json(Enum.map(checks, fn {name, r} -> %{check: name, status: r.status, message: r.message} end))
    else
      render_results(checks)
    end

    failed = Enum.count(checks, fn {_, r} -> r.status == :fail end)
    if failed > 0, do: System.halt(1)
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown doctor subcommand: #{inspect(sub)}")
    System.halt(1)
  end

  # ── Checks ──────────────────────────────────────────────────────────────

  defp check_daemon do
    %{status: :pass, message: "Daemon running, PID #{System.pid()}"}
  end

  defp check_db do
    safe(fn ->
      case Ecto.Adapters.SQL.query(Ema.Repo, "SELECT 1", []) do
        {:ok, _} -> %{status: :pass, message: "Connected"}
        {:error, reason} -> %{status: :fail, message: inspect(reason)}
      end
    end)
  end

  defp check_wal_mode do
    safe(fn ->
      case Ecto.Adapters.SQL.query(Ema.Repo, "PRAGMA journal_mode", []) do
        {:ok, %{rows: [["wal"]]}} ->
          %{status: :pass, message: "WAL enabled"}

        {:ok, %{rows: [[mode]]}} ->
          %{status: :warn, message: "Mode: #{mode} (WAL recommended)"}

        {:error, reason} ->
          %{status: :fail, message: inspect(reason)}
      end
    end)
  end

  defp check_foreign_keys do
    safe(fn ->
      case Ecto.Adapters.SQL.query(Ema.Repo, "PRAGMA foreign_keys", []) do
        {:ok, %{rows: [[1]]}} ->
          %{status: :pass, message: "Enabled"}

        {:ok, %{rows: [[0]]}} ->
          %{status: :fail, message: "DISABLED — data integrity at risk"}

        _ ->
          %{status: :fail, message: "Could not query"}
      end
    end)
  end

  defp check_migrations do
    safe(fn ->
      repos = Application.get_env(:ema, :ecto_repos, [Ema.Repo])

      pending =
        Enum.flat_map(repos, fn repo ->
          try do
            Ecto.Migrator.migrations(repo)
            |> Enum.filter(fn {status, _, _} -> status == :down end)
          rescue
            _ -> []
          end
        end)

      case pending do
        [] -> %{status: :pass, message: "All migrations applied"}
        list -> %{status: :warn, message: "#{length(list)} pending migration(s)"}
      end
    end)
  end

  defp check_claude_cli do
    case System.find_executable("claude") do
      nil -> %{status: :fail, message: "claude not in PATH"}
      path -> %{status: :pass, message: path}
    end
  end

  defp check_bridge do
    case Process.whereis(Ema.Claude.BridgeSupervisor) do
      nil ->
        if Application.get_env(:ema, :ai_backend) == :bridge do
          %{status: :fail, message: "BridgeSupervisor not running"}
        else
          %{status: :warn, message: "Bridge backend disabled (config :ai_backend)"}
        end

      pid ->
        %{status: :pass, message: "running #{inspect(pid)}"}
    end
  end

  defp check_engine do
    case Process.whereis(Ema.ProposalEngine.Supervisor) do
      nil -> %{status: :warn, message: "Proposal engine supervisor not running"}
      pid -> %{status: :pass, message: "running #{inspect(pid)}"}
    end
  end

  defp check_babysitter do
    case Process.whereis(Ema.Babysitter.Supervisor) do
      nil -> %{status: :warn, message: "Babysitter supervisor not running"}
      pid -> %{status: :pass, message: "running #{inspect(pid)}"}
    end
  end

  defp check_vault do
    path = Path.expand(@vault_path)

    cond do
      not File.exists?(path) ->
        %{status: :fail, message: "not found at #{path}"}

      not File.dir?(path) ->
        %{status: :fail, message: "exists but is not a directory"}

      true ->
        test_file = Path.join(path, ".ema_doctor_check")

        case File.write(test_file, "ok") do
          :ok ->
            File.rm(test_file)
            %{status: :pass, message: "writable at #{path}"}

          {:error, reason} ->
            %{status: :fail, message: "not writable: #{reason}"}
        end
    end
  end

  defp check_pubsub do
    safe(fn ->
      # Phoenix.PubSub uses Registry under the hood. Count keys in the registry.
      count =
        try do
          Registry.count(Ema.PubSub)
        rescue
          _ -> :unknown
        end

      case count do
        :unknown -> %{status: :warn, message: "could not introspect PubSub registry"}
        n when is_integer(n) -> %{status: :pass, message: "#{n} subscriber(s)"}
      end
    end)
  end

  defp check_memory do
    safe(fn ->
      mem = :erlang.memory()
      total_mb = Float.round(mem[:total] / 1_048_576, 1)
      proc_mb = Float.round(mem[:processes] / 1_048_576, 1)
      status = if total_mb > @memory_warn_mb, do: :warn, else: :pass
      %{status: status, message: "#{total_mb} MB total, #{proc_mb} MB processes"}
    end)
  end

  defp check_executions do
    safe(fn ->
      running = Ema.Executions.list_executions(status: "running") |> length()
      pending = Ema.Executions.list_executions(status: "pending") |> length()
      %{status: :pass, message: "#{running} running, #{pending} pending"}
    end)
  end

  defp check_proposals do
    safe(fn ->
      queued = Ema.Proposals.list_proposals(status: "queued") |> length()
      %{status: :pass, message: "#{queued} queued"}
    end)
  end

  defp check_disk do
    path = Path.expand("~/.local/share/ema/")

    case System.cmd("df", ["-Pk", path], stderr_to_stdout: true) do
      {output, 0} ->
        parse_df(output)

      {output, _} ->
        %{status: :warn, message: "df failed: #{String.trim(output)}"}
    end
  rescue
    _ -> %{status: :warn, message: "df unavailable"}
  end

  defp parse_df(output) do
    lines = String.split(output, "\n", trim: true)

    case lines do
      [_header, data | _] ->
        case String.split(data, ~r/\s+/, trim: true) do
          [_fs, _size, _used, avail, _capacity | _] ->
            avail_kb = String.to_integer(avail)
            avail_gb = Float.round(avail_kb / 1_048_576, 1)
            status = if avail_gb < 1.0, do: :fail, else: if(avail_gb < 5.0, do: :warn, else: :pass)
            %{status: status, message: "#{avail_gb} GB free"}

          _ ->
            %{status: :warn, message: "could not parse df output"}
        end

      _ ->
        %{status: :warn, message: "df output too short"}
    end
  rescue
    _ -> %{status: :warn, message: "could not parse df output"}
  end

  # ── Helpers ─────────────────────────────────────────────────────────────

  defp safe(fun) do
    try do
      fun.()
    rescue
      e -> %{status: :fail, message: "exception: #{Exception.message(e)}"}
    catch
      :exit, reason -> %{status: :fail, message: "exit: #{inspect(reason)}"}
    end
  end

  defp render_results(checks) do
    IO.puts("")
    IO.puts("#{IO.ANSI.bright()}#{IO.ANSI.cyan()}  EMA Doctor#{IO.ANSI.reset()}")
    IO.puts("  #{String.duplicate("─", 60)}")
    IO.puts("")

    Enum.each(checks, fn {name, result} ->
      icon =
        case result.status do
          :pass -> IO.ANSI.green() <> "✓" <> IO.ANSI.reset()
          :warn -> IO.ANSI.yellow() <> "!" <> IO.ANSI.reset()
          :fail -> IO.ANSI.red() <> "✗" <> IO.ANSI.reset()
        end

      label = String.pad_trailing(name, 26)
      IO.puts("    #{icon} #{label} #{IO.ANSI.faint()}#{result.message}#{IO.ANSI.reset()}")
    end)

    IO.puts("")
    pass = Enum.count(checks, fn {_, r} -> r.status == :pass end)
    warn = Enum.count(checks, fn {_, r} -> r.status == :warn end)
    fail = Enum.count(checks, fn {_, r} -> r.status == :fail end)

    summary =
      "  #{IO.ANSI.green()}#{pass} passed#{IO.ANSI.reset()}, " <>
        "#{IO.ANSI.yellow()}#{warn} warn#{IO.ANSI.reset()}, " <>
        "#{IO.ANSI.red()}#{fail} failed#{IO.ANSI.reset()}"

    IO.puts(summary)
    IO.puts("")
  end
end
