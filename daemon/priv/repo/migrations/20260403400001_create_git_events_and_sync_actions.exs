defmodule Ema.Repo.Migrations.CreateGitEventsAndSyncActions do
  use Ecto.Migration

  def change do
    create table(:git_events, primary_key: false) do
      add :id, :string, primary_key: true
      add :repo_path, :string, null: false
      add :commit_sha, :string, null: false
      add :author, :string, null: false
      add :message, :text, null: false
      add :changed_files, :map, default: %{}
      add :diff_summary, :text

      timestamps(type: :utc_datetime)
    end

    create unique_index(:git_events, [:commit_sha])
    create index(:git_events, [:repo_path])
    create index(:git_events, [:inserted_at])

    create table(:wiki_sync_actions, primary_key: false) do
      add :id, :string, primary_key: true
      add :git_event_id, references(:git_events, type: :string, on_delete: :delete_all),
        null: false
      add :action_type, :string, null: false
      add :wiki_path, :string, null: false
      add :suggestion, :text, null: false
      add :auto_applied, :boolean, null: false, default: false

      timestamps(type: :utc_datetime)
    end

    create index(:wiki_sync_actions, [:git_event_id])
    create index(:wiki_sync_actions, [:action_type])
    create index(:wiki_sync_actions, [:auto_applied])
  end
end
