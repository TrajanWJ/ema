defmodule Ema.Goals.GoalCheckIn do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "goal_check_ins" do
    field :note, :string
    field :progress_snapshot, :string, default: "{}"

    belongs_to :goal, Ema.Goals.Goal, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(check_in, attrs) do
    check_in
    |> cast(attrs, [:id, :goal_id, :note, :progress_snapshot])
    |> validate_required([:id, :goal_id])
  end

  def decoded_snapshot(%__MODULE__{progress_snapshot: snapshot}) do
    case Jason.decode(snapshot || "{}") do
      {:ok, map} -> map
      _ -> %{}
    end
  end
end
