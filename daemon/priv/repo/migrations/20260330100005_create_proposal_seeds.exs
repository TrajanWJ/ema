defmodule Ema.Repo.Migrations.CreateProposalSeeds do
  use Ecto.Migration

  def change do
    create table(:proposal_seeds, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :prompt_template, :text, null: false
      add :seed_type, :string, null: false
      add :schedule, :string
      add :active, :boolean, default: true
      add :last_run_at, :utc_datetime
      add :run_count, :integer, default: 0
      add :context_injection, :text, default: "{}"
      add :metadata, :text, default: "{}"
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:proposal_seeds, [:project_id])
    create index(:proposal_seeds, [:seed_type])
    create index(:proposal_seeds, [:active])
  end
end
