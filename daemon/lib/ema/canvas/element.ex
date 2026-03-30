defmodule Ema.Canvas.Element do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "canvas_elements" do
    field :element_type, :string
    field :x, :float, default: 0.0
    field :y, :float, default: 0.0
    field :width, :float, default: 100.0
    field :height, :float, default: 100.0
    field :rotation, :float, default: 0.0
    field :z_index, :integer, default: 0
    field :locked, :boolean, default: false
    field :style, :map, default: %{}
    field :text, :string
    field :points, {:array, :map}, default: []
    field :image_path, :string
    field :data_source, :string
    field :data_config, :map, default: %{}
    field :chart_config, :map, default: %{}
    field :refresh_interval, :integer
    field :group_id, :string

    belongs_to :canvas, Ema.Canvas.Canvas, type: :string

    timestamps(type: :utc_datetime)
  end

  @cast_fields [
    :id, :element_type, :x, :y, :width, :height, :rotation, :z_index,
    :locked, :style, :text, :points, :image_path, :data_source,
    :data_config, :chart_config, :refresh_interval, :group_id, :canvas_id
  ]

  def changeset(element, attrs) do
    element
    |> cast(attrs, @cast_fields)
    |> validate_required([:id, :element_type, :canvas_id])
  end
end
