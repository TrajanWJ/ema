defmodule Ema.Repo.Migrations.CreateTaskComments do
  use Ecto.Migration

  def change do
    create table(:task_comments, primary_key: false) do
      add :id, :string, primary_key: true
      add :body, :text, null: false
      add :source, :string, default: "user"
      add :task_id, references(:tasks, type: :string, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:task_comments, [:task_id])
  end
end
