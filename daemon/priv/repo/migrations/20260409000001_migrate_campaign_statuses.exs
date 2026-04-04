defmodule Ema.Repo.Migrations.MigrateCampaignStatuses do
  use Ecto.Migration

  def up do
    execute "UPDATE campaigns SET status = 'forming' WHERE status = 'draft'"
    execute "UPDATE campaigns SET status = 'running' WHERE status = 'active'"

    # SQLite doesn't support add_if_not_exists with references — use plain add
    alter table(:campaigns) do
      add :project_id, :binary_id, null: true
    end
  rescue
    _ -> :ok  # column may already exist from previous run
  end

  def down do
    execute "UPDATE campaigns SET status = 'draft' WHERE status = 'forming'"
    execute "UPDATE campaigns SET status = 'active' WHERE status = 'running'"

    alter table(:campaigns) do
      remove :project_id
    end
  rescue
    _ -> :ok
  end
end
