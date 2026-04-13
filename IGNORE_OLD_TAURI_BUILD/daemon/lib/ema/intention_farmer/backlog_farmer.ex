defmodule Ema.IntentionFarmer.BacklogFarmer do
  @moduledoc "Periodic batch harvester for AI terminal sessions. Full sweep with dedup."

  use Ema.Harvesters.Base, name: "intention", interval: :timer.hours(2)

  alias Ema.IntentionFarmer.{Parser, Cleaner, Loader, NoteEmitter, SourceRegistry}

  require Logger

  @impl Ema.Harvesters.Base
  def harvester_name, do: "intention"

  @impl Ema.Harvesters.Base
  def default_interval, do: :timer.hours(2)

  @impl Ema.Harvesters.Base
  def harvest(_context) do
    sources = SourceRegistry.sources()
    all_files = SourceRegistry.all_files(sources)

    # Parse all files
    parsed_results =
      all_files
      |> Enum.map(fn path ->
        case Parser.parse(path) do
          {:ok, result} -> result
          {:error, _} -> nil
        end
      end)
      |> Enum.reject(&is_nil/1)

    # Clean: dedup, remove empties, merge splits, score quality
    %{sessions: sessions, empties: empties, duplicates: duplicates} =
      Cleaner.clean(parsed_results)

    # Load all cleaned sessions
    stats = Loader.load_batch(sessions)
    note_stats = NoteEmitter.emit_batch(stats.sessions)

    Logger.info(
      "[IntentionFarmer.BacklogFarmer] Harvest complete: " <>
        "#{stats.loaded} loaded, #{stats.skipped} skipped, #{stats.failed} failed, " <>
        "#{stats.intents} intents, #{note_stats.emitted} notes, " <>
        "#{length(empties)} empty, #{length(duplicates)} duplicate"
    )

    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "intention_farmer:events",
      {:harvest_complete,
       %{
         files_scanned: length(all_files),
         sessions_cleaned: length(sessions),
         empties: length(empties),
         duplicates: length(duplicates),
         loaded: stats.loaded,
         intents: stats.intents,
         notes_emitted: note_stats.emitted
       }}
    )

    {:ok,
     %{
       items_found: length(all_files),
       seeds_created: 0,
       entities_created: stats.loaded,
       metadata: %{
         empties: length(empties),
         duplicates: length(duplicates),
         intents_loaded: stats.intents,
         notes_emitted: note_stats.emitted,
         skipped: stats.skipped,
         failed: stats.failed
       }
     }}
  rescue
    e -> {:error, Exception.message(e)}
  end
end
