defmodule Ema.CLI.Commands.Standards do
  @moduledoc """
  CLI for EMA's standards layer.

      ema standards check                show all current findings
      ema standards explain <check>      explain what a check looks for
      ema standards list                 list all check ids
      ema install hooks                  install git pre-commit hook (also exposed under `install`)
  """

  alias Ema.CLI.Output
  alias Ema.Standards.{Checks, Enforcer, HooksInstaller}

  def handle([], parsed, transport, opts), do: handle([:check], parsed, transport, opts)

  def handle([:check], _parsed, _transport, opts) do
    findings = Enforcer.run_all_checks()

    if opts[:json] do
      Output.json(findings)
    else
      print_findings(findings)
    end
  end

  def handle([:list], _parsed, _transport, opts) do
    rows =
      Enum.map(Checks.all(), fn c ->
        %{id: c.id, description: c.description}
      end)

    if opts[:json] do
      Output.json(rows)
    else
      Enum.each(rows, fn r ->
        IO.puts("  #{IO.ANSI.cyan()}#{r.id}#{IO.ANSI.reset()}")
        IO.puts("    #{IO.ANSI.faint()}#{r.description}#{IO.ANSI.reset()}")
        IO.puts("")
      end)
    end
  end

  def handle([:explain], _parsed, _transport, _opts) do
    Output.error("usage: ema standards explain <check_id>")
  end

  def handle([:explain | rest], parsed, _transport, opts) do
    id = List.first(rest) || parsed.args[:check_id]

    case Enforcer.explain(id) do
      {:ok, check} ->
        if opts[:json] do
          Output.json(%{id: check.id, description: check.description})
        else
          IO.puts("")
          IO.puts("  #{IO.ANSI.bright()}#{check.id}#{IO.ANSI.reset()}")
          IO.puts("")
          IO.puts("  #{check.description}")
          IO.puts("")
        end

      :error ->
        Output.error("unknown check: #{id}. Try `ema standards list`.")
    end
  end

  def handle([:install_hooks], parsed, _transport, _opts) do
    repo = parsed.options[:repo] || File.cwd!()

    case HooksInstaller.install(repo) do
      {:ok, path} ->
        IO.puts("  #{IO.ANSI.green()}installed#{IO.ANSI.reset()} #{path}")

      {:error, :not_a_git_repo} ->
        Output.error("not a git repository: #{repo}")

      {:error, reason} ->
        Output.error("install failed: #{inspect(reason)}")
    end
  end

  def handle(other, _parsed, _transport, _opts) do
    Output.error("unknown standards subcommand: #{inspect(other)}")
  end

  defp print_findings([]) do
    IO.puts("")
    IO.puts("  #{IO.ANSI.green()}No findings — standards clean.#{IO.ANSI.reset()}")
    IO.puts("")
  end

  defp print_findings(findings) do
    IO.puts("")
    IO.puts("  #{IO.ANSI.bright()}EMA Standards — #{length(findings)} finding(s)#{IO.ANSI.reset()}")
    IO.puts("  #{String.duplicate("─", 50)}")
    IO.puts("")

    Enum.each(findings, fn f ->
      icon = severity_icon(f.severity)
      IO.puts("  #{icon} #{IO.ANSI.cyan()}#{f.check_id}#{IO.ANSI.reset()}")
      IO.puts("    #{f.summary}")
      IO.puts("")
    end)
  end

  defp severity_icon(:error), do: "#{IO.ANSI.red()}✗#{IO.ANSI.reset()}"
  defp severity_icon(:warn), do: "#{IO.ANSI.yellow()}!#{IO.ANSI.reset()}"
  defp severity_icon(_), do: "#{IO.ANSI.blue()}i#{IO.ANSI.reset()}"
end
