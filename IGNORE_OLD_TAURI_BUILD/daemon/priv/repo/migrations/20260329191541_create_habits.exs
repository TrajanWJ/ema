defmodule Ema.Repo.Migrations.CreateHabits do
  use Ecto.Migration

  def change do
    create table(:habits, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :frequency, :string, null: false, default: "daily"
      add :target, :string
      add :active, :boolean, null: false, default: true
      add :sort_order, :integer, null: false, default: 0
      add :color, :string
      timestamps(type: :utc_datetime)
    end

    create table(:habit_logs, primary_key: false) do
      add :id, :string, primary_key: true
      add :habit_id, references(:habits, type: :string, on_delete: :delete_all), null: false
      add :date, :string, null: false
      add :completed, :boolean, null: false, default: false
      add :notes, :text
      timestamps(type: :utc_datetime)
    end

    create unique_index(:habit_logs, [:habit_id, :date])
    create index(:habit_logs, [:habit_id])
    create index(:habit_logs, [:date])
  end
end
