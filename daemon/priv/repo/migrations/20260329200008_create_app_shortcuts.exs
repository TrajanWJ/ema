defmodule Place.Repo.Migrations.CreateAppShortcuts do
  use Ecto.Migration

  def change do
    create table(:app_shortcuts, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :exec_command, :string, null: false
      add :icon_path, :string
      add :category, :string
      add :sort_order, :integer, default: 0

      timestamps(type: :utc_datetime)
    end

    create index(:app_shortcuts, [:category])
  end
end
