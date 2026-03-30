defmodule Ema.Pipes.Pipe do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "pipes" do
    field :name, :string
    field :system, :boolean, default: false
    field :active, :boolean, default: true
    field :trigger_pattern, :string
    field :description, :string
    field :metadata, :map, default: %{}

    # project_id stored as raw field — Ema.Projects.Project defined in a
    # separate plan. Will be upgraded to belongs_to when Projects is merged.
    field :project_id, :string

    has_many :pipe_actions, Ema.Pipes.PipeAction
    has_many :pipe_transforms, Ema.Pipes.PipeTransform

    timestamps(type: :utc_datetime)
  end

  def changeset(pipe, attrs) do
    pipe
    |> cast(attrs, [:id, :name, :system, :active, :trigger_pattern, :description, :metadata, :project_id])
    |> validate_required([:id, :name, :trigger_pattern])
    |> validate_format(:trigger_pattern, ~r/^[a-z_]+:[a-z_]+$/, message: "must be context:event format")
  end
end
