defmodule Ema.Repo.Migrations.CreateIngestJobs do
  use Ecto.Migration

  def change do
    create table(:ingest_jobs, primary_key: false) do
      add :id, :string, primary_key: true
      add :source_type, :string, null: false
      add :source_uri, :text
      add :status, :string, null: false, default: "pending"
      add :extracted_title, :string
      add :extracted_summary, :text
      add :extracted_tags, :text, default: "[]"
      add :vault_path, :string
      add :error_message, :text

      timestamps(type: :utc_datetime)
    end

    create index(:ingest_jobs, [:status])
    create index(:ingest_jobs, [:source_type])
  end
end
