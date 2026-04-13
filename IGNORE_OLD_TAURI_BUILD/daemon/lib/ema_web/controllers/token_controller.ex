defmodule EmaWeb.TokenController do
  use EmaWeb, :controller

  alias Ema.Intelligence.TokenTracker

  action_fallback EmaWeb.FallbackController

  def summary(conn, _params) do
    json(conn, TokenTracker.summary())
  end

  def history(conn, params) do
    days = parse_int(params["days"]) || 30
    json(conn, %{history: TokenTracker.history(days)})
  end

  def forecast(conn, _params) do
    json(conn, TokenTracker.forecast())
  end

  def budget(conn, _params) do
    budget = TokenTracker.get_or_create_budget()
    summary = TokenTracker.summary()

    json(conn, %{
      monthly_budget: budget.monthly_budget_usd,
      alert_threshold_pct: budget.alert_threshold_pct,
      current_spend: summary.month_cost,
      percent_used: summary.percent_used,
      days_remaining: summary.days_remaining
    })
  end

  def set_budget(conn, %{"amount_usd" => amount}) when is_number(amount) do
    case TokenTracker.set_budget(amount) do
      {:ok, budget} ->
        json(conn, %{ok: true, monthly_budget: budget.monthly_budget_usd})

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def set_budget(conn, _params) do
    conn |> put_status(400) |> json(%{error: "amount_usd (number) required"})
  end

  defp parse_int(nil), do: nil
  defp parse_int(val) when is_integer(val), do: val

  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      :error -> nil
    end
  end
end
