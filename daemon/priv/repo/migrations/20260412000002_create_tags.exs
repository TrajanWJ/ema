defmodule Ema.Repo.Migrations.CreateTags do
  use Ecto.Migration

  def change do
    create table(:tags, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :slug, :string, null: false
      add :color, :string
      add :actor_id, references(:actors, type: :string, on_delete: :nilify_all)
      add :space_id, references(:spaces, type: :string, on_delete: :delete_all)

      timestamps(type: :utc_datetime)
    end

    create unique_index(:tags, [:space_id, :slug])
    create index(:tags, [:actor_id])

    create table(:entity_tags, primary_key: false) do
      add :id, :string, primary_key: true
      add :tag_id, references(:tags, type: :string, on_delete: :delete_all), null: false
      add :entity_type, :string, null: false
      add :entity_id, :string, null: false
      add :actor_id, references(:actors, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create unique_index(:entity_tags, [:tag_id, :entity_type, :entity_id])
    create index(:entity_tags, [:entity_type, :entity_id])
  end
end
