defmodule Ema.Repo.Migrations.CreateProjectMilestonesAndRisks do
  use Ecto.Migration

  def change do
    create_if_not_exists table(:project_milestones, primary_key: false) do
      add :id, :string, primary_key: true
      add :project_id, :string
      add :name, :string, null: false
      add :target_date, :date
      add :status, :string, default: "pending"
      add :deliverables, :map, default: %{"items" => []}

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists index(:project_milestones, [:project_id])

    create_if_not_exists table(:project_risks, primary_key: false) do
      add :id, :string, primary_key: true
      add :project_id, :string
      add :description, :string, null: false
      add :probability, :string, default: "medium"
      add :impact, :string, default: "medium"
      add :mitigation, :string
      add :status, :string, default: "open"

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists index(:project_risks, [:project_id])
  end
end
