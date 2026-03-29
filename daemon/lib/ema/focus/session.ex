defmodule Ema.Focus.Session do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "focus_sessions" do
    field :started_at, :utc_datetime
    field :ended_at, :utc_datetime
    field :target_ms, :integer

    has_many :blocks, Ema.Focus.Block

    timestamps(type: :utc_datetime)
  end

  def changeset(session, attrs) do
    session
    |> cast(attrs, [:id, :started_at, :ended_at, :target_ms])
    |> validate_required([:id, :started_at])
  end
end
