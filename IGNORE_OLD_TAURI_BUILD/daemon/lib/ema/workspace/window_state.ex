defmodule Ema.Workspace.WindowState do
  use Ecto.Schema
  import Ecto.Changeset

  schema "workspace_windows" do
    field :app_id, :string
    field :is_open, :boolean, default: false
    field :x, :integer
    field :y, :integer
    field :width, :integer
    field :height, :integer
    field :is_maximized, :boolean, default: false

    timestamps()
  end

  @required_fields [:app_id]
  @optional_fields [:is_open, :x, :y, :width, :height, :is_maximized]

  def changeset(window_state, attrs) do
    window_state
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> unique_constraint(:app_id)
  end
end
