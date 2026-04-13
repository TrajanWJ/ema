defmodule Ema.Repo.Migrations.CreateHarvesterRuns do
  use Ecto.Migration

  def change do
    create table(:harvester_runs, primary_key: false) do
      add :id, :string, primary_key: true
      add :harvester, :string, null: false
      add :status, :string, null: false, default: "running"
      add :items_found, :integer, default: 0
      add :seeds_created, :integer, default: 0
      add :entities_created, :integer, default: 0
      add :error, :text
      add :metadata, :map, default: %{}
      add :started_at, :utc_datetime, null: false
      add :completed_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:harvester_runs, [:harvester])
    create index(:harvester_runs, [:started_at])
  end
end
