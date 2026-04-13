defmodule Ema.Billing.Client do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "billing_clients" do
    field :name, :string
    field :email, :string
    field :company, :string
    field :billing_address, :string
    field :payment_terms_days, :integer, default: 30
    field :notes, :string

    timestamps(type: :utc_datetime)
  end

  def changeset(client, attrs) do
    client
    |> cast(attrs, [:id, :name, :email, :company, :billing_address, :payment_terms_days, :notes])
    |> validate_required([:id, :name])
    |> validate_number(:payment_terms_days, greater_than: 0)
  end
end
