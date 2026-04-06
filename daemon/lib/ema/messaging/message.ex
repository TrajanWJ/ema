defmodule Ema.Messaging.Message do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "messaging_messages" do
    field :sender_id, :string
    field :body, :string
    field :attachments, :string, default: "[]"

    belongs_to :conversation, Ema.Messaging.Conversation, type: :string
    belongs_to :reply_to, __MODULE__, type: :string, foreign_key: :reply_to_id

    timestamps(type: :utc_datetime)
  end

  def changeset(message, attrs) do
    message
    |> cast(attrs, [:id, :conversation_id, :sender_id, :body, :attachments, :reply_to_id])
    |> validate_required([:id, :conversation_id, :sender_id, :body])
    |> foreign_key_constraint(:conversation_id)
  end
end
