defmodule EmaWeb.IngestController do
  use EmaWeb, :controller

  alias Ema.Ingestor

  action_fallback EmaWeb.FallbackController

  def index(conn, _params) do
    jobs = Ingestor.list_jobs() |> Enum.map(&serialize/1)
    json(conn, %{jobs: jobs})
  end

  def show(conn, %{"id" => id}) do
    case Ingestor.get_job(id) do
      nil -> {:error, :not_found}
      job -> json(conn, %{job: serialize(job)})
    end
  end

  def create(conn, params) do
    attrs = %{
      source_type: params["source_type"],
      source_uri: params["source_uri"]
    }

    with {:ok, job} <- Ingestor.create_job(attrs) do
      conn
      |> put_status(:created)
      |> json(serialize(job))
    end
  end

  defp serialize(job) do
    %{
      id: job.id,
      source_type: job.source_type,
      source_uri: job.source_uri,
      status: job.status,
      extracted_title: job.extracted_title,
      extracted_summary: job.extracted_summary,
      extracted_tags: job.extracted_tags,
      vault_path: job.vault_path,
      created_at: job.inserted_at,
      updated_at: job.updated_at
    }
  end
end
