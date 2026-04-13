defmodule Ema.Repo.Migrations.CreateRoutinesAndLogs do
  use Ecto.Migration

  def change do
    create_if_not_exists table(:routines, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :description, :text
      add :steps, :text, null: false, default: "{}"
      add :cadence, :string, default: "daily"
      add :active, :boolean, default: true
      add :last_run_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists table(:routine_logs, primary_key: false) do
      add :id, :string, primary_key: true
      add :routine_id, references(:routines, type: :string, on_delete: :delete_all), null: false
      add :date, :string, null: false
      add :completed_steps, :text, null: false, default: "[]"
      add :started_at, :utc_datetime
      add :completed_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists index(:routine_logs, [:routine_id])
    create_if_not_exists index(:routine_logs, [:date])
  end
end
