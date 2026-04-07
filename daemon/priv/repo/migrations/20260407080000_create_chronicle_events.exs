defmodule Ema.Repo.Migrations.CreateChronicleEvents do
  use Ecto.Migration

  def change do
    create table(:chronicle_events, primary_key: false) do
      add :id, :string, primary_key: true
      add :entity_type, :string, null: false
      add :entity_id, :string, null: false
      add :action, :string, null: false
      add :actor_id, :string
      add :prev_state, :map
      add :new_state, :map
      add :metadata, :map, default: %{}

      timestamps(type: :utc_datetime)
    end

    create index(:chronicle_events, [:entity_type, :entity_id])
    create index(:chronicle_events, [:inserted_at])
    create index(:chronicle_events, [:actor_id])
  end
end
