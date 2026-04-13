defmodule Ema.Repo.Migrations.CreateClaudeUsageRecords do
  use Ecto.Migration

  def change do
    create table(:claude_usage_records) do
      add :session_id, :string, null: false
      add :model, :string
      add :input_tokens, :integer, default: 0
      add :output_tokens, :integer, default: 0
      add :cost_usd, :float
      add :campaign_slug, :string
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)

      timestamps()
    end

    create index(:claude_usage_records, [:session_id])
    create index(:claude_usage_records, [:campaign_slug])
    create index(:claude_usage_records, [:inserted_at])
  end
end
