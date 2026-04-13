defmodule Ema.Repo.Migrations.CreateContainerConfig do
  use Ecto.Migration

  def change do
    create table(:container_config, primary_key: false) do
      add :id, :string, primary_key: true
      add :container_type, :string, null: false
      add :container_id, :string, null: false
      add :key, :string, null: false
      add :value, :map, default: %{}

      timestamps(type: :utc_datetime)
    end

    create unique_index(:container_config, [:container_type, :container_id, :key])
  end
end
