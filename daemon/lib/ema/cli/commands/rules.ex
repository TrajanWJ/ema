defmodule Ema.CLI.Commands.Rules do
  @moduledoc "CLI commands for agent safety rules."

  alias Ema.CLI.Output

  def handle([:list], _parsed, _transport, opts) do
    rules = Ema.Agents.SafetyRules.all_rules()

    if opts[:json] do
      Output.detail(%{rules: rules}, json: true)
    else
      IO.puts("\nAgent Safety Rules")
      IO.puts(String.duplicate("-", 60))

      for rule <- rules do
        action_label =
          case rule.action do
            :deny -> "\e[31mDENY\e[0m"
            :warn -> "\e[33mWARN\e[0m"
          end

        IO.puts("  #{rule.id}  [#{action_label}]  /#{rule.pattern}/  — #{rule.reason}")
      end

      IO.puts("")
    end
  end

  def handle([:check], parsed, _transport, opts) do
    command = parsed[:args][:command] || List.first(parsed[:rest] || []) || ""

    if command == "" do
      Output.error("Usage: ema rules check <command>")
    else
      case Ema.Agents.SafetyRules.check(command) do
        :allow ->
          if opts[:json] do
            Output.detail(%{result: "allow", command: command}, json: true)
          else
            IO.puts("\e[32mALLOW\e[0m: #{command}")
          end

        {:warn, rule} ->
          if opts[:json] do
            Output.detail(
              %{result: "warn", rule_id: rule.id, reason: rule.reason, command: command},
              json: true
            )
          else
            IO.puts("\e[33mWARN\e[0m [#{rule.id}]: #{rule.reason}")
            IO.puts("  Command: #{command}")
          end

        {:deny, rule} ->
          if opts[:json] do
            Output.detail(
              %{result: "deny", rule_id: rule.id, reason: rule.reason, command: command},
              json: true
            )
          else
            IO.puts("\e[31mDENY\e[0m [#{rule.id}]: #{rule.reason}")
            IO.puts("  Command: #{command}")
          end
      end
    end
  end

  def handle([], _parsed, _transport, _opts) do
    handle([:list], %{}, nil, %{})
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown rules subcommand: #{inspect(sub)}. Available: list, check")
  end
end
