defmodule Ema.Repo.Migrations.CreateExecutions do
  use Ecto.Migration

  def change do
    create table(:executions, primary_key: false) do
      add :id,                :string, primary_key: true
      add :project_slug,      :string
      add :intent_slug,       :string
      add :title,             :string, null: false
      add :objective,         :text
      add :mode,              :string, null: false, default: "implement"
      add :status,            :string, null: false, default: "created"
      add :requires_approval, :boolean, default: true, null: false
      add :intent_path,       :string
      add :result_path,       :string
      add :agent_session_id,  :string
      add :brain_dump_item_id, :string
      add :proposal_id,       references(:proposals, type: :string, on_delete: :nilify_all)
      add :task_id,           references(:tasks, type: :string, on_delete: :nilify_all)
      add :session_id,        references(:claude_sessions, type: :string, on_delete: :nilify_all)
      add :metadata,          :map, default: %{}
      add :completed_at,      :utc_datetime
      timestamps(type: :utc_datetime)
    end

    create index(:executions, [:status])
    create index(:executions, [:project_slug])
    create index(:executions, [:intent_slug])
    create index(:executions, [:proposal_id])
    create index(:executions, [:session_id])
    create index(:executions, [:brain_dump_item_id])
  end
end
