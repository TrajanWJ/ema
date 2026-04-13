defmodule Ema.Agents.Message do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "agent_messages" do
    field :role, :string
    field :content, :string
    field :tool_calls, {:array, :map}, default: []
    field :token_count, :integer
    field :metadata, :map, default: %{}

    belongs_to :conversation, Ema.Agents.Conversation, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_roles ~w(user assistant system tool)
  @required_fields ~w(id role conversation_id)a
  @optional_fields ~w(content tool_calls token_count metadata)a

  def changeset(message, attrs) do
    message
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:role, @valid_roles)
  end
end
