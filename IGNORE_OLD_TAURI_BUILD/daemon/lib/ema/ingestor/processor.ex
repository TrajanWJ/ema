defmodule Ema.Ingestor.Processor do
  @moduledoc """
  GenServer that watches for pending ingest jobs and processes them.
  Currently a stub that transitions jobs through status states.
  Full implementation will extract content, run AI summarization, and store in vault.
  """

  use GenServer
  require Logger

  alias Ema.Ingestor

  @poll_interval_ms 10_000

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    schedule_poll()
    {:ok, %{processing: false}}
  end

  @impl true
  def handle_info(:poll, state) do
    state = maybe_process_next(state)
    schedule_poll()
    {:noreply, state}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  defp maybe_process_next(%{processing: true} = state), do: state

  defp maybe_process_next(state) do
    case Ingestor.list_jobs(status: "pending", limit: 1) do
      [job] ->
        process_job(job)
        state

      _ ->
        state
    end
  end

  defp process_job(job) do
    Logger.info("Ingestor processing job #{job.id} (#{job.source_type})")

    case Ingestor.mark_processing(job.id) do
      {:ok, _} ->
        # Stub: mark done with placeholder extraction
        Ingestor.mark_done(job.id, %{
          extracted_title: extract_title(job),
          extracted_summary: "Ingested from #{job.source_type}",
          extracted_tags: Jason.encode!(["ingested", job.source_type])
        })

      {:error, reason} ->
        Logger.warning("Failed to process ingest job #{job.id}: #{inspect(reason)}")
    end
  end

  defp extract_title(job) do
    cond do
      job.source_uri && String.length(job.source_uri) > 0 ->
        job.source_uri |> String.split("/") |> List.last() |> String.slice(0, 100)

      true ->
        "Untitled #{job.source_type} import"
    end
  end

  defp schedule_poll do
    Process.send_after(self(), :poll, @poll_interval_ms)
  end
end
