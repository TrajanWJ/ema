defmodule Ema.Repo.Migrations.CreateGoalKeyResultsAndCheckIns do
  use Ecto.Migration

  def change do
    create_if_not_exists table(:goal_key_results, primary_key: false) do
      add :id, :string, primary_key: true
      add :goal_id, references(:goals, type: :string, on_delete: :delete_all), null: false
      add :description, :string, null: false
      add :metric_type, :string, null: false, default: "number"
      add :target_value, :decimal, null: false, default: 100
      add :current_value, :decimal, null: false, default: 0
      add :unit, :string
      add :due_date, :string

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists table(:goal_check_ins, primary_key: false) do
      add :id, :string, primary_key: true
      add :goal_id, references(:goals, type: :string, on_delete: :delete_all), null: false
      add :note, :text
      add :progress_snapshot, :text, null: false, default: "{}"

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists index(:goal_key_results, [:goal_id])
    create_if_not_exists index(:goal_check_ins, [:goal_id])
  end
end
