defmodule Ema.Pipes.PipeRun do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @valid_statuses ~w(success failed skipped)

  schema "pipe_runs" do
    field :status, :string
    field :trigger_event, :map, default: %{}
    field :started_at, :utc_datetime
    field :completed_at, :utc_datetime
    field :error, :string

    belongs_to :pipe, Ema.Pipes.Pipe, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(run, attrs) do
    run
    |> cast(attrs, [:id, :status, :trigger_event, :started_at, :completed_at, :error, :pipe_id])
    |> validate_required([:id, :status, :pipe_id, :started_at])
    |> validate_inclusion(:status, @valid_statuses)
  end

  def valid_statuses, do: @valid_statuses
end
