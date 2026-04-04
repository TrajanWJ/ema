defmodule Ema.Repo.Migrations.CreateContextFragments do
  use Ecto.Migration

  def change do
    create table(:context_fragments, primary_key: false) do
      add :id, :string, primary_key: true
      add :project_slug, :string, null: false
      add :fragment_type, :string, null: false
      add :content, :text, null: false
      add :file_path, :string
      add :relevance_score, :float, default: 0.0, null: false

      timestamps(updated_at: false, type: :utc_datetime)
    end

    create index(:context_fragments, [:project_slug])
    create index(:context_fragments, [:fragment_type])
    create index(:context_fragments, [:relevance_score])
    create index(:context_fragments, [:project_slug, :relevance_score])
  end
end
