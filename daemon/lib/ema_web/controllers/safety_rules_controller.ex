defmodule EmaWeb.SafetyRulesController do
  use EmaWeb, :controller

  alias Ema.Agents.SafetyRules

  def index(conn, _params) do
    json(conn, %{rules: SafetyRules.all_rules()})
  end

  def check(conn, %{"command" => command}) do
    result =
      case SafetyRules.check(command) do
        :allow ->
          %{result: "allow", command: command}

        {:warn, rule} ->
          %{result: "warn", rule_id: rule.id, reason: rule.reason, command: command}

        {:deny, rule} ->
          %{result: "deny", rule_id: rule.id, reason: rule.reason, command: command}
      end

    json(conn, result)
  end

  def check(conn, _params) do
    conn |> put_status(400) |> json(%{error: "command parameter required"})
  end
end
