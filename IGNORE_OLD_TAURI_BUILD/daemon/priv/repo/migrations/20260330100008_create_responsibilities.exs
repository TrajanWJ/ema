defmodule Ema.Repo.Migrations.CreateResponsibilities do
  use Ecto.Migration

  def change do
    create table(:responsibilities, primary_key: false) do
      add :id, :string, primary_key: true
      add :title, :string, null: false
      add :description, :text
      add :role, :string
      add :cadence, :string
      add :health, :string, default: "healthy"
      add :active, :boolean, default: true
      add :last_checked_at, :utc_datetime
      add :recurrence_rule, :string
      add :metadata, :text, default: "{}"
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:responsibilities, [:project_id])
    create index(:responsibilities, [:active])
  end
end
