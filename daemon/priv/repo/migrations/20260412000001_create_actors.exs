defmodule Ema.Repo.Migrations.CreateActors do
  use Ecto.Migration

  def change do
    create table(:actors, primary_key: false) do
      add :id, :string, primary_key: true
      add :space_id, references(:spaces, type: :string, on_delete: :delete_all)
      add :type, :string, null: false
      add :name, :string, null: false
      add :slug, :string, null: false
      add :capabilities, :map, default: %{}
      add :config, :map, default: %{}
      add :phase, :string, default: "idle"
      add :phase_started_at, :utc_datetime
      add :status, :string, default: "active"

      timestamps(type: :utc_datetime)
    end

    create unique_index(:actors, [:space_id, :slug])
    create index(:actors, [:type])
    create index(:actors, [:status])
  end
end
