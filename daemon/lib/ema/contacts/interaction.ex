defmodule Ema.Contacts.Interaction do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "contact_interactions" do
    field :type, :string, default: "message"
    field :summary, :string
    field :date, :string

    belongs_to :contact, Ema.Contacts.Contact, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_types ~w(call email meeting message)

  def changeset(interaction, attrs) do
    interaction
    |> cast(attrs, [:id, :contact_id, :type, :summary, :date])
    |> validate_required([:id, :contact_id, :type, :date])
    |> validate_inclusion(:type, @valid_types)
  end
end
