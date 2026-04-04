defmodule Ema.Repo.Migrations.CreateCampaignTemplates do
  use Ecto.Migration

  def change do
    create table(:campaigns, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :description, :string
      add :steps, :text, default: "[]"
      add :status, :string, null: false, default: "draft"
      add :run_count, :integer, default: 0

      timestamps(type: :utc_datetime)
    end

    create index(:campaigns, [:status])
    create index(:campaigns, [:inserted_at])

    create table(:campaign_runs, primary_key: false) do
      add :id, :string, primary_key: true
      add :campaign_id, references(:campaigns, type: :string, on_delete: :delete_all), null: false
      add :name, :string
      add :status, :string, null: false, default: "pending"
      add :step_statuses, :text, default: "{}"
      add :started_at, :utc_datetime
      add :completed_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:campaign_runs, [:campaign_id])
    create index(:campaign_runs, [:status])
    create index(:campaign_runs, [:started_at])
  end
end
