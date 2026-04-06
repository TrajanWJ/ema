defmodule Ema.Team.Standup do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "standups" do
    field :member_id, :string
    field :date, :date
    field :yesterday, :string
    field :today, :string
    field :blockers, :string
    field :mood, :integer, default: 3

    timestamps(type: :utc_datetime)
  end

  def changeset(standup, attrs) do
    standup
    |> cast(attrs, [:id, :member_id, :date, :yesterday, :today, :blockers, :mood])
    |> validate_required([:id, :member_id, :date])
    |> validate_inclusion(:mood, [1, 2, 3, 4, 5])
  end
end
