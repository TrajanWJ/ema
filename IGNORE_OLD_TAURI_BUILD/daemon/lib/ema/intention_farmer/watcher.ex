defmodule Ema.IntentionFarmer.Watcher do
  @moduledoc "Incremental file watcher for AI terminal sessions. Polls every 30s."

  use GenServer
  require Logger

  @poll_interval :timer.seconds(30)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def status do
    GenServer.call(__MODULE__, :status)
  end

  @impl GenServer
  def init(_opts) do
    schedule_poll()
    {:ok, %{known_files: %{}, processed_count: 0, last_poll_at: nil}}
  end

  @impl GenServer
  def handle_call(:status, _from, state) do
    {:reply,
     %{
       known_files: map_size(state.known_files),
       processed_count: state.processed_count,
       last_poll_at: state.last_poll_at
     }, state}
  end

  @impl GenServer
  def handle_info(:poll, state) do
    state = do_poll(state)
    schedule_poll()
    {:noreply, state}
  end

  defp schedule_poll do
    Process.send_after(self(), :poll, @poll_interval)
  end

  defp do_poll(state) do
    sources = Ema.IntentionFarmer.SourceRegistry.sources()

    all_files =
      Ema.IntentionFarmer.SourceRegistry.all_files(sources)

    # Get current mtimes
    current_files =
      all_files
      |> Enum.map(fn path ->
        case File.stat(path, time: :posix) do
          {:ok, %{mtime: mtime}} -> {path, mtime}
          _ -> nil
        end
      end)
      |> Enum.reject(&is_nil/1)
      |> Map.new()

    # Find new or changed files
    new_or_changed =
      current_files
      |> Enum.filter(fn {path, mtime} ->
        case Map.get(state.known_files, path) do
          nil -> true
          prev_mtime -> mtime > prev_mtime
        end
      end)
      |> Enum.map(fn {path, _mtime} -> path end)

    # Process each new/changed file via Task.Supervisor
    processed =
      Enum.count(new_or_changed, fn path ->
        Task.Supervisor.start_child(Ema.IntentionFarmer.TaskSupervisor, fn ->
          process_file(path)
        end)

        true
      end)

    %{
      state
      | known_files: current_files,
        processed_count: state.processed_count + processed,
        last_poll_at: DateTime.utc_now() |> DateTime.truncate(:second)
    }
  end

  defp process_file(path) do
    alias Ema.IntentionFarmer.{Parser, Cleaner, Loader, NoteEmitter}

    case Parser.parse(path) do
      {:ok, parsed} ->
        # Clean as a single-item batch to get dedup + quality scoring
        %{sessions: sessions} = Cleaner.clean([parsed])

        case sessions do
          [scored | _] ->
            case Loader.load(scored) do
              {:ok, result} ->
                _ = NoteEmitter.emit(result.session)

                Logger.debug(
                  "[IntentionFarmer.Watcher] Loaded #{path}: #{result.intents_loaded} intents"
                )

              {:error, :already_exists} ->
                :ok

              {:error, reason} ->
                Logger.warning(
                  "[IntentionFarmer.Watcher] Failed to load #{path}: #{inspect(reason)}"
                )
            end

          [] ->
            Logger.debug("[IntentionFarmer.Watcher] Session cleaned out as empty: #{path}")
        end

      {:error, :empty_session} ->
        Logger.debug("[IntentionFarmer.Watcher] Skipping empty session: #{path}")

      {:error, reason} ->
        Logger.warning("[IntentionFarmer.Watcher] Failed to parse #{path}: #{inspect(reason)}")
    end
  rescue
    e ->
      Logger.warning(
        "[IntentionFarmer.Watcher] Error processing #{path}: #{Exception.message(e)}"
      )
  end
end
