defmodule Ema.Repo.Migrations.CreateWorkspaceWindows do
  use Ecto.Migration

  def change do
    create table(:workspace_windows) do
      add :app_id, :string, null: false
      add :is_open, :boolean, default: false, null: false
      add :x, :integer
      add :y, :integer
      add :width, :integer
      add :height, :integer
      add :is_maximized, :boolean, default: false, null: false

      timestamps()
    end

    create unique_index(:workspace_windows, [:app_id])
  end
end
