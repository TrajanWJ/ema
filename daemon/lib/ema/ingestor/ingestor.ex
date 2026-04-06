defmodule Ema.Ingestor do
  @moduledoc """
  Ingestor — manages ingest jobs that import external content into the vault.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Ingestor.IngestJob

  def list_jobs do
    IngestJob
    |> order_by(desc: :inserted_at)
    |> Repo.all()
  end

  def get_job!(id), do: Repo.get!(IngestJob, id)

  def create_job(attrs) do
    %IngestJob{}
    |> IngestJob.changeset(attrs)
    |> Repo.insert()
  end

  def get_job_by_source_uri(source_uri) when is_binary(source_uri) do
    Repo.get_by(IngestJob, source_uri: source_uri)
  end

  def ensure_job(attrs) do
    source_uri = attrs[:source_uri] || attrs["source_uri"]

    case get_job_by_source_uri(source_uri) do
      nil -> create_job(attrs)
      job -> {:ok, job}
    end
  end

  def update_job(%IngestJob{} = job, attrs) do
    job
    |> IngestJob.changeset(attrs)
    |> Repo.update()
  end

  def list_pending_jobs do
    IngestJob
    |> where([j], j.status == "pending")
    |> order_by(asc: :inserted_at)
    |> Repo.all()
  end
end
