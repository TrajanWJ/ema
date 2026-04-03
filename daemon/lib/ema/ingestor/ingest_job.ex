defmodule Ema.Ingestor.IngestJob do
  use Ecto.Schema
  import Ecto.Changeset

  @valid_statuses ~w(pending processing done failed)

  schema "ingest_jobs" do
    field :source_type, :string
    field :source_uri, :string
    field :status, :string, default: "pending"
    field :extracted_title, :string
    field :extracted_summary, :string
    field :extracted_tags, {:array, :string}, default: []
    field :vault_path, :string

    timestamps(type: :utc_datetime)
  end

  def changeset(job, attrs) do
    job
    |> cast(attrs, [
      :source_type,
      :source_uri,
      :status,
      :extracted_title,
      :extracted_summary,
      :extracted_tags,
      :vault_path
    ])
    |> validate_required([:source_type, :source_uri])
    |> validate_inclusion(:status, @valid_statuses)
  end
end
