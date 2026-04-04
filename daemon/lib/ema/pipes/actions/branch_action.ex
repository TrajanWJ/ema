defmodule Ema.Pipes.Actions.BranchAction do
  @moduledoc """
  Pipes Action: Conditional Branching.

  Evaluates a condition against the pipe payload and adds `_branch_taken`
  to indicate which path the executor should follow.

  ## Config Keys

    - `condition`  — map with `field`, `operator`, and `value` keys
    - `if_true`    — action_id to execute when condition is true
    - `if_false`   — action_id to execute when condition is false

  ## Condition Operators

    - `eq`         — field equals value
    - `neq`        — field does not equal value
    - `gt`         — field > value (numeric)
    - `gte`        — field >= value (numeric)
    - `lt`         — field < value (numeric)
    - `lte`        — field <= value (numeric)
    - `exists`     — field is present and non-nil
    - `not_exists` — field is absent or nil
    - `contains`   — field (string/list) contains value
    - `matches`    — field matches regex pattern in value

  ## Example Pipe Config

      %{
        action_id: "branch",
        config: %{
          "condition" => %{"field" => "status", "operator" => "eq", "value" => "approved"},
          "if_true"  => "tasks:create",
          "if_false" => "notify:log"
        }
      }

  ## Return Value

  Adds `_branch_taken` ("true" | "false") and `_branch_next` (the resolved
  action_id) to the payload. The executor reads `_branch_next` to determine
  the next step.
  """

  require Logger

  @doc "Evaluate branch condition and annotate payload."
  def execute(payload, config) do
    config = normalize_config(config)

    result = evaluate_condition(payload, config.condition)
    branch_taken = if result, do: "true", else: "false"
    next_action = if result, do: config.if_true, else: config.if_false

    Logger.debug("[BranchAction] condition=#{inspect(config.condition)} result=#{result} next=#{next_action}")

    updated =
      payload
      |> Map.put("_branch_taken", branch_taken)
      |> Map.put("_branch_next", next_action)

    {:ok, updated}
  end

  # ── Private ──────────────────────────────────────────────────────────────────

  defp normalize_config(config) when is_map(config) do
    %{
      condition: config["condition"] || config[:condition] || %{},
      if_true: config["if_true"] || config[:if_true],
      if_false: config["if_false"] || config[:if_false]
    }
  end

  defp evaluate_condition(payload, condition) when is_map(condition) do
    field = condition["field"] || condition[:field]
    operator = condition["operator"] || condition[:operator] || "eq"
    expected = condition["value"] || condition[:value]

    actual = payload[field] || payload[String.to_atom(field || "")]

    apply_operator(operator, actual, expected)
  rescue
    e ->
      Logger.warning("[BranchAction] Condition evaluation error: #{Exception.message(e)}")
      false
  end

  defp evaluate_condition(_payload, _condition), do: false

  defp apply_operator("eq", actual, expected), do: actual == expected
  defp apply_operator("neq", actual, expected), do: actual != expected
  defp apply_operator("exists", actual, _), do: not is_nil(actual)
  defp apply_operator("not_exists", actual, _), do: is_nil(actual)

  defp apply_operator("gt", actual, expected) do
    to_number(actual) > to_number(expected)
  end

  defp apply_operator("gte", actual, expected) do
    to_number(actual) >= to_number(expected)
  end

  defp apply_operator("lt", actual, expected) do
    to_number(actual) < to_number(expected)
  end

  defp apply_operator("lte", actual, expected) do
    to_number(actual) <= to_number(expected)
  end

  defp apply_operator("contains", actual, expected) when is_binary(actual) do
    String.contains?(actual, to_string(expected))
  end

  defp apply_operator("contains", actual, expected) when is_list(actual) do
    Enum.member?(actual, expected)
  end

  defp apply_operator("matches", actual, pattern) when is_binary(actual) and is_binary(pattern) do
    case Regex.compile(pattern) do
      {:ok, regex} -> Regex.match?(regex, actual)
      _ -> false
    end
  end

  defp apply_operator(op, actual, expected) do
    Logger.warning("[BranchAction] Unknown operator '#{op}' for #{inspect(actual)} vs #{inspect(expected)}")
    false
  end

  defp to_number(val) when is_number(val), do: val
  defp to_number(val) when is_binary(val) do
    case Float.parse(val) do
      {n, _} -> n
      :error -> 0
    end
  end

  defp to_number(_), do: 0
end
