defmodule Ema.Repo.Migrations.CreateSpaces do
  use Ecto.Migration

  def change do
    create table(:spaces, primary_key: false) do
      add :id, :string, primary_key: true
      add :org_id, references(:organizations, type: :string, on_delete: :delete_all), null: false
      add :name, :string, null: false
      add :space_type, :string, default: "personal", null: false
      add :ai_privacy, :string, default: "isolated", null: false
      add :icon, :string
      add :color, :string
      add :settings, :map, default: %{}
      add :archived_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:spaces, [:org_id])
    create index(:spaces, [:space_type])

    create table(:space_members, primary_key: false) do
      add :id, :string, primary_key: true
      add :space_id, references(:spaces, type: :string, on_delete: :delete_all), null: false
      add :identity_id, :string, null: false
      add :role, :string, null: false
      add :joined_at, :utc_datetime
      add :revoked_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:space_members, [:space_id])
    create unique_index(:space_members, [:space_id, :identity_id])
  end
end
