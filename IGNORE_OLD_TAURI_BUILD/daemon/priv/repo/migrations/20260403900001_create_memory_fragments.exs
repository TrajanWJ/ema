defmodule Ema.Repo.Migrations.CreateMemoryFragments do
  use Ecto.Migration

  def change do
    create table(:memory_fragments, primary_key: false) do
      add :id, :string, primary_key: true
      add :session_id, references(:claude_sessions, type: :string, on_delete: :delete_all)
      add :fragment_type, :string, null: false
      add :content, :text, null: false
      add :importance_score, :float, default: 0.5
      add :project_path, :string

      timestamps(type: :utc_datetime)
    end

    create index(:memory_fragments, [:session_id])
    create index(:memory_fragments, [:fragment_type])
    create index(:memory_fragments, [:project_path])
    create index(:memory_fragments, [:importance_score])
  end
end
