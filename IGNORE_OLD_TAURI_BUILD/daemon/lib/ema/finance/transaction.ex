defmodule Ema.Finance.Transaction do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "finance_transactions" do
    field :description, :string
    field :amount, :decimal
    field :type, :string
    field :category, :string
    field :date, :date
    field :project_id, :string
    field :recurring, :boolean, default: false
    field :notes, :string

    timestamps(type: :utc_datetime)
  end

  @valid_types ~w(income expense)

  def changeset(transaction, attrs) do
    transaction
    |> cast(attrs, [
      :id,
      :description,
      :amount,
      :type,
      :category,
      :date,
      :project_id,
      :recurring,
      :notes
    ])
    |> validate_required([:id, :description, :amount, :type])
    |> validate_inclusion(:type, @valid_types)
  end
end
