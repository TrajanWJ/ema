defmodule Ema.Repo.Migrations.DropOldTables do
  use Ecto.Migration

  def change do
    drop_if_exists table(:vault_index)
    drop_if_exists index(:app_shortcuts, [:category])
    drop_if_exists table(:app_shortcuts)
  end
end
