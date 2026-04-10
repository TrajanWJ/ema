defmodule Ema.Repo.Migrations.CreateLoops do
  use Ecto.Migration

  def change do
    create table(:loops, primary_key: false) do
      add :id, :string, primary_key: true
      add :loop_type, :string, null: false
      add :target, :string
      add :context, :string
      add :channel, :string
      add :opened_on, :date, null: false
      add :touch_count, :integer, default: 1
      add :escalation_level, :integer, default: 0
      add :last_escalated, :date
      add :status, :string, default: "open"
      add :closed_on, :date
      add :closed_by, :string
      add :closed_reason, :string
      add :follow_up_text, :text
      add :actor_id, references(:actors, type: :string, on_delete: :nilify_all)
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)
      add :task_id, references(:tasks, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:loops, [:status])
    create index(:loops, [:opened_on])
    create index(:loops, [:escalation_level])
    create index(:loops, [:actor_id])
    create index(:loops, [:project_id])
  end
end
