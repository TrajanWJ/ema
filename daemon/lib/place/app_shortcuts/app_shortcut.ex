defmodule Place.AppShortcuts.AppShortcut do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "app_shortcuts" do
    field :name, :string
    field :exec_command, :string
    field :icon_path, :string
    field :category, :string
    field :sort_order, :integer, default: 0

    timestamps(type: :utc_datetime)
  end

  def changeset(shortcut, attrs) do
    shortcut
    |> cast(attrs, [:id, :name, :exec_command, :icon_path, :category, :sort_order])
    |> validate_required([:id, :name, :exec_command])
  end
end
