defmodule Ema.Finance.Account do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "finance_accounts" do
    field :name, :string
    field :type, :string, default: "checking"
    field :balance, :decimal, default: Decimal.new(0)
    field :currency, :string, default: "USD"
    field :institution, :string
    field :last_synced_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  @valid_types ~w(checking savings credit investment)

  def changeset(account, attrs) do
    account
    |> cast(attrs, [:id, :name, :type, :balance, :currency, :institution, :last_synced_at])
    |> validate_required([:id, :name, :type])
    |> validate_inclusion(:type, @valid_types)
  end
end
