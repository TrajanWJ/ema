defmodule Ema.Repo.Migrations.CreateEntityData do
  use Ecto.Migration

  def change do
    create table(:entity_data, primary_key: false) do
      add :id, :string, primary_key: true
      add :actor_id, references(:actors, type: :string, on_delete: :delete_all), null: false
      add :entity_type, :string, null: false
      add :entity_id, :string, null: false
      add :key, :string, null: false
      add :value, :map, default: %{}

      timestamps(type: :utc_datetime)
    end

    create unique_index(:entity_data, [:actor_id, :entity_type, :entity_id, :key])
    create index(:entity_data, [:entity_type, :entity_id])
  end
end
