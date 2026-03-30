defmodule Ema.Pipes.PipeAction do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "pipe_actions" do
    field :action_id, :string
    field :config, :map, default: %{}
    field :sort_order, :integer, default: 0

    belongs_to :pipe, Ema.Pipes.Pipe, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(action, attrs) do
    action
    |> cast(attrs, [:id, :action_id, :config, :sort_order, :pipe_id])
    |> validate_required([:id, :action_id, :pipe_id])
  end
end
