defmodule Ema.Finance.Budget do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "finance_budgets" do
    field :name, :string
    field :category, :string
    field :amount_limit, :decimal
    field :period, :string, default: "monthly"
    field :current_spent, :decimal, default: Decimal.new(0)

    timestamps(type: :utc_datetime)
  end

  @valid_periods ~w(monthly weekly)

  def changeset(budget, attrs) do
    budget
    |> cast(attrs, [:id, :name, :category, :amount_limit, :period, :current_spent])
    |> validate_required([:id, :name, :category, :amount_limit, :period])
    |> validate_inclusion(:period, @valid_periods)
  end
end
