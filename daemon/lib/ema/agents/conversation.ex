defmodule Ema.Agents.Conversation do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "agent_conversations" do
    field :channel_type, :string
    field :channel_id, :string
    field :external_user_id, :string
    field :status, :string, default: "active"
    field :metadata, :map, default: %{}

    belongs_to :agent, Ema.Agents.Agent, type: :string

    has_many :messages, Ema.Agents.Message

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(active archived)
  @valid_channel_types ~w(discord telegram webchat api)
  @required_fields ~w(id channel_type agent_id)a
  @optional_fields ~w(channel_id external_user_id status metadata)a

  def changeset(conversation, attrs) do
    conversation
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:status, @valid_statuses)
    |> validate_inclusion(:channel_type, @valid_channel_types)
  end
end
