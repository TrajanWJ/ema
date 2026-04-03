defmodule Ema.Invoices.Invoice do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "invoices" do
    field :contact_id, :string
    field :project_id, :string
    field :items, :map, default: %{}
    field :subtotal, :decimal
    field :tax, :decimal
    field :total, :decimal
    field :status, :string, default: "draft"
    field :due_date, :date
    field :paid_at, :utc_datetime
    field :notes, :string

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(draft sent paid overdue)

  def changeset(invoice, attrs) do
    invoice
    |> cast(attrs, [:id, :contact_id, :project_id, :items, :subtotal, :tax, :total, :status, :due_date, :paid_at, :notes])
    |> validate_required([:id, :status])
    |> validate_inclusion(:status, @valid_statuses)
  end
end
