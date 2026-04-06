defmodule Ema.Ingestor do
  @moduledoc """
  Knowledge Ingestor context — CRUD for ingest jobs.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Ingestor.IngestJob

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end

  def list_jobs(opts \\ []) do
    IngestJob
    |> maybe_filter_status(opts[:status])
    |> maybe_filter_source_type(opts[:source_type])
    |> order_by(desc: :inserted_at)
    |> maybe_limit(opts[:limit])
    |> Repo.all()
  end

  def get_job(id), do: Repo.get(IngestJob, id)

  def create_job(attrs) do
    id = generate_id("ingest")

    %IngestJob{}
    |> IngestJob.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_ok(&broadcast("job_created", &1))
  end

  def update_job(%IngestJob{} = job, attrs) do
    job
    |> IngestJob.changeset(attrs)
    |> Repo.update()
    |> tap_ok(&broadcast("job_updated", &1))
  end

  def delete_job(%IngestJob{} = job) do
    Repo.delete(job)
    |> tap_ok(fn _ -> broadcast("job_deleted", %{id: job.id}) end)
  end

  def mark_processing(id) do
    case get_job(id) do
      nil -> {:error, :not_found}
      job -> update_job(job, %{status: "processing"})
    end
  end

  def mark_done(id, attrs) do
    case get_job(id) do
      nil -> {:error, :not_found}
      job -> update_job(job, Map.put(attrs, :status, "done"))
    end
  end

  def mark_failed(id, error_message) do
    case get_job(id) do
      nil -> {:error, :not_found}
      job -> update_job(job, %{status: "failed", error_message: error_message})
    end
  end

  defp maybe_filter_status(query, nil), do: query
  defp maybe_filter_status(query, status), do: where(query, [j], j.status == ^status)

  defp maybe_filter_source_type(query, nil), do: query
  defp maybe_filter_source_type(query, st), do: where(query, [j], j.source_type == ^st)

  defp maybe_limit(query, nil), do: query
  defp maybe_limit(query, n), do: limit(query, ^n)

  defp tap_ok({:ok, val} = result, fun) do
    fun.(val)
    result
  end

  defp tap_ok(error, _fun), do: error

  defp broadcast(event, payload) do
    EmaWeb.Endpoint.broadcast("ingestor:lobby", event, serialize(payload))
  end

  def serialize(%IngestJob{} = j) do
    %{
      id: j.id,
      source_type: j.source_type,
      source_uri: j.source_uri,
      status: j.status,
      extracted_title: j.extracted_title,
      extracted_summary: j.extracted_summary,
      extracted_tags: decode_json(j.extracted_tags),
      vault_path: j.vault_path,
      error_message: j.error_message,
      created_at: j.inserted_at,
      updated_at: j.updated_at
    }
  end

  def serialize(%{id: _} = map), do: map

  defp decode_json(nil), do: []
  defp decode_json(str) when is_binary(str) do
    case Jason.decode(str) do
      {:ok, val} -> val
      _ -> []
    end
  end
  defp decode_json(other), do: other
end
