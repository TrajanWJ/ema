defmodule Ema.Canvas.Canvas do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @valid_types ~w(freeform dashboard planning research monitoring)

  schema "canvases" do
    field :name, :string
    field :description, :string
    field :canvas_type, :string, default: "freeform"
    field :viewport, :map, default: %{"x" => 0, "y" => 0, "zoom" => 1}
    field :settings, :map, default: %{"grid" => true, "snap" => true}
    field :project_id, :string

    has_many :elements, Ema.Canvas.Element

    timestamps(type: :utc_datetime)
  end

  def changeset(canvas, attrs) do
    canvas
    |> cast(attrs, [:id, :name, :description, :canvas_type, :viewport, :settings, :project_id])
    |> validate_required([:id, :name])
    |> validate_inclusion(:canvas_type, @valid_types)
  end
end
