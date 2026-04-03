defmodule Ema.Repo.Migrations.AddFocusTaskAndSummary do
  use Ecto.Migration

  def change do
    alter table(:focus_sessions) do
      add :task_id, :string
      add :summary, :text
    end

    create index(:focus_sessions, [:task_id])
  end
end
