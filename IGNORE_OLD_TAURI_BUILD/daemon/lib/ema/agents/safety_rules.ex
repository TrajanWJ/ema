defmodule Ema.Agents.SafetyRules do
  @moduledoc """
  Declarative safety rules for agent command execution.

  Each rule has an id, action (:deny or :warn), a regex pattern, and a reason.
  `check/1` scans a command string against all rules and returns:
    - `:allow` if no rule matches
    - `{:warn, rule}` for the first matching :warn rule
    - `{:deny, rule}` for the first matching :deny rule

  Deny rules are checked before warn rules so a deny always wins.
  """

  @rules [
    %{id: "R01", action: :deny, pattern: ~r/git push --force/, reason: "No force pushes"},
    %{id: "R02", action: :warn, pattern: ~r/rm -rf/, reason: "Destructive command"},
    %{id: "R03", action: :deny, pattern: ~r/DROP TABLE|TRUNCATE/i, reason: "Destructive SQL"},
    %{id: "R04", action: :warn, pattern: ~r/--no-verify/, reason: "Skipping hooks"},
    %{id: "R05", action: :deny, pattern: ~r/sudo/, reason: "No sudo"},
    %{id: "R06", action: :deny, pattern: ~r/chmod 777/, reason: "Overly permissive permissions"},
    %{id: "R07", action: :warn, pattern: ~r/git reset --hard/, reason: "Destructive git reset"},
    %{id: "R08", action: :deny, pattern: ~r/mkfs|fdisk|parted/, reason: "Filesystem operations"}
  ]

  @doc "Check a command string against all safety rules."
  @spec check(String.t()) :: :allow | {:warn, map()} | {:deny, map()}
  def check(command) when is_binary(command) do
    # Deny rules first — they take priority
    deny =
      Enum.find(@rules, fn rule ->
        rule.action == :deny and Regex.match?(rule.pattern, command)
      end)

    if deny do
      {:deny, deny}
    else
      warn =
        Enum.find(@rules, fn rule ->
          rule.action == :warn and Regex.match?(rule.pattern, command)
        end)

      if warn, do: {:warn, warn}, else: :allow
    end
  end

  @doc "Return all safety rules as serializable maps (pattern as string)."
  @spec all_rules() :: [map()]
  def all_rules do
    Enum.map(@rules, fn rule ->
      %{
        id: rule.id,
        action: rule.action,
        pattern: Regex.source(rule.pattern),
        reason: rule.reason
      }
    end)
  end
end
