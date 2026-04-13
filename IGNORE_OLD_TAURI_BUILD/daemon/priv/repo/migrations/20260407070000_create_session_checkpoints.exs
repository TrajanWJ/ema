defmodule Ema.Repo.Migrations.CreateSessionCheckpoints do
  use Ecto.Migration

  def change do
    create table(:session_checkpoints, primary_key: false) do
      add :id, :string, primary_key: true
      add :session_id, :string, null: false
      add :execution_id, :string
      add :intent_id, :string
      add :phase, :string
      add :files_modified, :text, default: "[]"
      add :conversation_summary, :text
      add :git_diff_summary, :text
      add :last_tool_call, :text
      add :checkpoint_at, :utc_datetime, null: false
    end

    create index(:session_checkpoints, [:session_id])
    create index(:session_checkpoints, [:execution_id])
  end
end
