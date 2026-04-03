defmodule Ema.Contacts.Contact do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "contacts" do
    field :name, :string
    field :email, :string
    field :phone, :string
    field :company, :string
    field :role, :string
    field :notes, :string
    field :tags, :map, default: %{}
    field :status, :string, default: "active"

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(active archived)

  def changeset(contact, attrs) do
    contact
    |> cast(attrs, [:id, :name, :email, :phone, :company, :role, :notes, :tags, :status])
    |> validate_required([:id, :name])
    |> validate_inclusion(:status, @valid_statuses)
  end
end
