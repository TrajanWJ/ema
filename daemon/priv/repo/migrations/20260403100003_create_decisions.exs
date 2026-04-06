defmodule Ema.Repo.Migrations.CreateDecisions do
  use Ecto.Migration

  def change do
    create table(:decisions, primary_key: false) do
      add :id, :string, primary_key: true
      add :title, :string, null: false
      add :context, :text
      add :options, :text, default: "[]"
      add :chosen_option, :string
      add :decided_by, :string
      add :reasoning, :text
      add :outcome, :text
      add :outcome_score, :integer
      add :tags, :text, default: "[]"

      timestamps(type: :utc_datetime)
    end

    create index(:decisions, [:decided_by])
    create index(:decisions, [:outcome_score])
  end
end
