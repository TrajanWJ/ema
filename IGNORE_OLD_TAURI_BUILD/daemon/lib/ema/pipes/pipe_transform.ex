defmodule Ema.Pipes.PipeTransform do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @valid_types ~w(filter map delay claude conditional)

  schema "pipe_transforms" do
    field :transform_type, :string
    field :config, :map, default: %{}
    field :sort_order, :integer, default: 0

    belongs_to :pipe, Ema.Pipes.Pipe, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(transform, attrs) do
    transform
    |> cast(attrs, [:id, :transform_type, :config, :sort_order, :pipe_id])
    |> validate_required([:id, :transform_type, :pipe_id])
    |> validate_inclusion(:transform_type, @valid_types)
  end

  def valid_types, do: @valid_types
end
