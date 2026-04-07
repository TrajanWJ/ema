defmodule Ema.IntentionFarmer.StartupBootstrap do
  @moduledoc "Runs a one-shot onboarding sweep shortly after EMA boots."

  require Logger

  alias Ema.Settings
  alias Ema.CliManager.Scanner
  alias Ema.IntentionFarmer
  alias Ema.IntentionFarmer.{BacklogFarmer, ImportCatalog, NoteEmitter, SourceRegistry}

  def run do
    Logger.info("[IntentionFarmer.StartupBootstrap] Starting boot-time onboarding sweep")

    tools = Scanner.scan()
    sources = SourceRegistry.refresh_now()
    imports = ImportCatalog.sync()
    harvest_result = BacklogFarmer.harvest(%{mode: :startup})

    note_stats =
      IntentionFarmer.list_sessions(limit: 5_000)
      |> NoteEmitter.emit_batch()

    payload = %{
      tools_detected: length(tools),
      sources_discovered: sources.total_files,
      imports_cataloged: length(imports),
      harvest_result: summarize_result(harvest_result),
      notes_emitted: note_stats.emitted,
      notes_failed: note_stats.failed
    }

    _ = Settings.set("onboarding.last_bootstrap", Jason.encode!(payload))

    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "intention_farmer:events",
      {:startup_bootstrap_complete, payload}
    )

    Logger.info(
      "[IntentionFarmer.StartupBootstrap] Completed boot-time onboarding: #{inspect(payload)}"
    )

    {:ok, payload}
  rescue
    e ->
      Logger.warning("[IntentionFarmer.StartupBootstrap] Failed: #{Exception.message(e)}")
      {:error, Exception.message(e)}
  end

  def run_async(delay_ms \\ 4_000) do
    Task.start(fn ->
      Process.sleep(delay_ms)
      run()
    end)
  end

  defp summarize_result({:ok, result}), do: result
  defp summarize_result({:error, reason}), do: %{error: inspect(reason)}
  defp summarize_result(other), do: %{result: inspect(other)}
end
