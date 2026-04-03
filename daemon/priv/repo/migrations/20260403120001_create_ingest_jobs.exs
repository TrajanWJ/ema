defmodule Ema.Repo.Migrations.CreateIngestJobs do
  use Ecto.Migration

  def change do
    create table(:ingest_jobs) do
      add :source_type, :string, null: false
      add :source_uri, :string, null: false
      add :status, :string, default: "pending", null: false
      add :extracted_title, :string
      add :extracted_summary, :text
      add :extracted_tags, :text, default: "[]"
      add :vault_path, :string

      timestamps(type: :utc_datetime)
    end

    create index(:ingest_jobs, [:status])
    create index(:ingest_jobs, [:source_type])
  end
end
