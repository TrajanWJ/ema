defmodule Ema.Intelligence.TokenBudget do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "token_budgets" do
    field :monthly_budget_usd, :float, default: 100.0
    field :alert_threshold_pct, :integer, default: 80

    timestamps(type: :utc_datetime)
  end

  def changeset(budget, attrs) do
    budget
    |> cast(attrs, [:id, :monthly_budget_usd, :alert_threshold_pct])
    |> validate_required([:id, :monthly_budget_usd])
    |> validate_number(:monthly_budget_usd, greater_than: 0)
    |> validate_number(:alert_threshold_pct, greater_than: 0, less_than_or_equal_to: 100)
  end
end
