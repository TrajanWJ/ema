defmodule Ema.Repo.Migrations.AddEmbeddingFieldsToInboxAndClusters do
  use Ecto.Migration

  def change do
    # Embedding fields on inbox_items
    alter table(:inbox_items) do
      add :embedding, :binary
      add :embedding_version, :string
      add :embedding_status, :string, default: "pending"
      add :surfaced_proposal_id, :string
    end

    create index(:inbox_items, [:embedding_status])

    # New fields on intent_clusters for the brain-dump-to-proposal loop
    alter table(:intent_clusters) do
      add :source_fingerprint, :string
      add :proposal_id, :string
      add :centroid_embedding, :binary
      add :last_evaluated_at, :utc_datetime
    end

    create unique_index(:intent_clusters, [:source_fingerprint])
  end
end
