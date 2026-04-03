defmodule Ema.Executions.Event do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "execution_events" do
    field :type,       :string
    field :actor_kind, :string, default: "system"
    field :payload,    :map, default: %{}
    field :at,         :utc_datetime

    belongs_to :execution, Ema.Executions.Execution, type: :string
  end

  @valid_actor_kinds ~w(system user agent harvester pipe)

  def changeset(event, attrs) do
    event
    |> cast(attrs, [:id, :execution_id, :type, :actor_kind, :payload, :at])
    |> validate_required([:id, :execution_id, :type, :at])
    |> validate_inclusion(:actor_kind, @valid_actor_kinds)
  end
end
