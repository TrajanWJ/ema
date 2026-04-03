defmodule Ema.Repo.Migrations.CreateRoutines do
  use Ecto.Migration

  def change do
    create table(:routines, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :description, :text
      add :steps, :map, default: %{}
      add :cadence, :string, default: "daily"
      add :active, :boolean, default: true
      add :last_run_at, :utc_datetime
      timestamps(type: :utc_datetime)
    end
  end
end
