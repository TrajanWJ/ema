defmodule Ema.Intelligence.VmHealthEvent do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "vm_health_events" do
    field :status, :string, default: "unknown"
    field :openclaw_up, :boolean, default: false
    field :ssh_up, :boolean, default: false
    field :containers_json, :string, default: "[]"
    field :latency_ms, :integer
    field :checked_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(online offline degraded unknown)

  def changeset(event, attrs) do
    event
    |> cast(attrs, [
      :id,
      :status,
      :openclaw_up,
      :ssh_up,
      :containers_json,
      :latency_ms,
      :checked_at
    ])
    |> validate_required([:id, :status, :checked_at])
    |> validate_inclusion(:status, @valid_statuses)
  end
end
