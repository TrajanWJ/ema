defmodule Ema.Routines.RoutineLog do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "routine_logs" do
    field :date, :string
    field :completed_steps, :string, default: "[]"
    field :started_at, :utc_datetime
    field :completed_at, :utc_datetime

    belongs_to :routine, Ema.Routines.Routine, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(log, attrs) do
    log
    |> cast(attrs, [:id, :routine_id, :date, :completed_steps, :started_at, :completed_at])
    |> validate_required([:id, :routine_id, :date])
  end

  def decoded_completed_steps(%__MODULE__{completed_steps: steps}) do
    case Jason.decode(steps || "[]") do
      {:ok, list} -> list
      _ -> []
    end
  end
end
