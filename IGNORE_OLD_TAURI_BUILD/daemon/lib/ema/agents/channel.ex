defmodule Ema.Agents.Channel do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "agent_channels" do
    field :channel_type, :string
    field :active, :boolean, default: true
    field :config, :map, default: %{}
    field :status, :string, default: "disconnected"
    field :connection_status, :string, default: "disconnected"
    field :last_connected_at, :utc_datetime
    field :error_message, :string

    belongs_to :agent, Ema.Agents.Agent, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_types ~w(discord telegram webchat api)
  @valid_statuses ~w(connected disconnected error degraded unknown)
  @required_fields ~w(id channel_type agent_id)a
  @optional_fields ~w(active config status connection_status last_connected_at error_message)a

  def changeset(channel, attrs) do
    channel
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:channel_type, @valid_types)
    |> validate_inclusion(:status, @valid_statuses)
  end
end
