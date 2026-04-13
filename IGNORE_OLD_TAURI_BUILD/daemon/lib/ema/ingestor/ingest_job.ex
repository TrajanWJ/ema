defmodule Ema.Ingestor.IngestJob do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "ingest_jobs" do
    field :source_type, :string
    field :source_uri, :string
    field :status, :string, default: "pending"
    field :extracted_title, :string
    field :extracted_summary, :string
    field :extracted_tags, :string, default: "[]"
    field :vault_path, :string
    field :error_message, :string

    timestamps(type: :utc_datetime)
  end

  @valid_source_types ~w(url file text clipboard)
  @valid_statuses ~w(pending processing done failed)
  @required_fields ~w(id source_type)a
  @optional_fields ~w(source_uri status extracted_title extracted_summary extracted_tags vault_path error_message)a

  def changeset(job, attrs) do
    job
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:source_type, @valid_source_types)
    |> validate_inclusion(:status, @valid_statuses)
  end
end
