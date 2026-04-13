defmodule Ema.Messaging.Conversation do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "messaging_conversations" do
    field :type, :string, default: "direct"
    field :name, :string
    field :participants, :string, default: "[]"

    has_many :messages, Ema.Messaging.Message

    timestamps(type: :utc_datetime)
  end

  @valid_types ~w(direct group channel)

  def changeset(conversation, attrs) do
    conversation
    |> cast(attrs, [:id, :type, :name, :participants])
    |> validate_required([:id, :type])
    |> validate_inclusion(:type, @valid_types)
  end
end
