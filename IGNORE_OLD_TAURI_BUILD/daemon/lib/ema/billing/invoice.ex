defmodule Ema.Billing.Invoice do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "invoices" do
    field :client_id, :string
    field :number, :string
    field :status, :string, default: "draft"
    field :items, :map, default: %{"items" => []}
    field :subtotal, :float, default: 0.0
    field :tax_rate, :float, default: 0.0
    field :total, :float, default: 0.0
    field :due_date, :date
    field :paid_at, :utc_datetime
    field :notes, :string

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(draft sent paid overdue)

  def changeset(invoice, attrs) do
    invoice
    |> cast(attrs, [
      :id,
      :client_id,
      :number,
      :status,
      :items,
      :subtotal,
      :tax_rate,
      :total,
      :due_date,
      :paid_at,
      :notes
    ])
    |> validate_required([:id, :number])
    |> validate_inclusion(:status, @valid_statuses)
    |> validate_number(:subtotal, greater_than_or_equal_to: 0)
    |> validate_number(:total, greater_than_or_equal_to: 0)
    |> unique_constraint(:number)
  end
end
