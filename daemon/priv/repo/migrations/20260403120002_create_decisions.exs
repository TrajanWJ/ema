defmodule Ema.Repo.Migrations.CreateDecisions do
  use Ecto.Migration

  def change do
    create table(:decisions) do
      add :title, :string, null: false
      add :context, :text
      add :options, :text, default: "[]"
      add :chosen_option, :string
      add :decided_by, :string, null: false
      add :reasoning, :text
      add :outcome, :text
      add :outcome_score, :integer
      add :tags, :text, default: "[]"
      add :space_id, :string
      add :reviewed_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:decisions, [:decided_by])
    create index(:decisions, [:space_id])
  end
end
