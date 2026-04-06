defmodule Ema.Ingestor.Processor do
  @moduledoc """
  GenServer that periodically checks for pending ingest jobs and processes them.
  Currently stubs actual processing — transitions pending -> processing -> done.
  """

  use GenServer
  require Logger

  alias Ema.Ingestor

  @poll_interval :timer.seconds(30)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    schedule_poll()
    {:ok, %{}}
  end

  @impl true
  def handle_info(:poll, state) do
    process_pending_jobs()
    schedule_poll()
    {:noreply, state}
  end

  defp schedule_poll do
    Process.send_after(self(), :poll, @poll_interval)
  end

  defp process_pending_jobs do
    jobs = Ingestor.list_pending_jobs()

    Enum.each(jobs, fn job ->
      Logger.info("Processing ingest job #{job.id} (#{job.source_type}: #{job.source_uri})")

      with {:ok, processing} <- Ingestor.update_job(job, %{status: "processing"}),
           {:ok, _done} <- run_extraction(processing) do
        Logger.info("Ingest job #{job.id} completed")
      else
        {:error, reason} ->
          Logger.warning("Ingest job #{job.id} failed: #{inspect(reason)}")
          Ingestor.update_job(job, %{status: "failed"})
      end
    end)
  end

  # Stub: actual extraction would parse content, extract metadata, write to vault.
  # For now, just mark as done with placeholder metadata.
  defp run_extraction(job) do
    parsed =
      if String.starts_with?(job.source_uri || "", "/") and File.exists?(job.source_uri) do
        Ema.IntentionFarmer.Parser.parse_external_import(job.source_uri)
      else
        {:error, :missing_source}
      end

    {title, summary, tags} =
      case parsed do
        {:ok, result} ->
          metadata = result[:metadata] || %{}

          {
            Path.basename(job.source_uri || "import"),
            Map.get(metadata, "preview", "Auto-imported from #{job.source_type}"),
            [
              "imported",
              job.source_type,
              Map.get(metadata, "provider_guess"),
              Map.get(metadata, "dataset_guess")
            ]
            |> Enum.reject(&is_nil/1)
          }

        _ ->
          {
            "Imported: #{job.source_uri}",
            "Auto-imported from #{job.source_type}",
            ["imported", job.source_type]
          }
      end

    Ingestor.update_job(job, %{
      status: "done",
      extracted_title: title,
      extracted_summary: summary,
      extracted_tags: tags
    })
  end
end
