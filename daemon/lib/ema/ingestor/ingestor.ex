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
