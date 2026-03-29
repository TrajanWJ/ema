defmodule Ema.Focus.Block do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "focus_blocks" do
    field :block_type, :string
    field :started_at, :utc_datetime
    field :ended_at, :utc_datetime
    field :elapsed_ms, :integer

    belongs_to :session, Ema.Focus.Session, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(block, attrs) do
    block
    |> cast(attrs, [:id, :block_type, :started_at, :ended_at, :elapsed_ms, :session_id])
    |> validate_required([:id, :block_type, :started_at])
  end
end
