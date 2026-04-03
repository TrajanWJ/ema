defmodule Ema.Repo.Migrations.CreateTemporalRhythms do
  use Ecto.Migration

  def change do
    create table(:temporal_rhythms, primary_key: false) do
      add :id, :string, primary_key: true, null: false
      add :day_of_week, :integer, null: false
      add :hour, :integer, null: false
      add :energy_level, :float, default: 5.0, null: false
      add :focus_quality, :float, default: 5.0, null: false
      add :preferred_task_types, :string, default: "[]"
      add :sample_count, :integer, default: 0, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:temporal_rhythms, [:day_of_week, :hour])

    create table(:temporal_energy_logs, primary_key: false) do
      add :id, :string, primary_key: true, null: false
      add :energy_level, :float, null: false
      add :focus_quality, :float
      add :activity_type, :string
      add :source, :string, default: "manual"
      add :logged_at, :utc_datetime, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:temporal_energy_logs, [:logged_at])
    create index(:temporal_energy_logs, [:source])
  end
end
