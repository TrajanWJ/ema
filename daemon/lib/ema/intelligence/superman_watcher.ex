defmodule Ema.Intelligence.SupermanWatcher do
  @moduledoc """
  Polls project linked paths for `.superman/` folder changes.

  Broadcasts `"superman:updated:{project_id}"` via PubSub when file
  mtimes change, so downstream consumers can refresh cached context.
  """

  use GenServer
  require Logger

  @poll_interval_ms 60_000
  @superman_dir ".superman"

  # -- Public API -------------------------------------------------------------

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: via(opts[:project_id]))
  end

  @doc """
  Start watching a project's linked paths for `.superman/` changes.
  Spawns a watcher under the Intelligence DynamicSupervisor if available,
  otherwise starts standalone.
  """
  def start_watching(%{id: project_id, linked_path: linked_path})
      when is_binary(linked_path) do
    opts = [project_id: project_id, linked_path: linked_path]

    case Process.whereis(Ema.Intelligence.WatcherSupervisor) do
      nil ->
        start_link(opts)

      _pid ->
        DynamicSupervisor.start_child(
          Ema.Intelligence.WatcherSupervisor,
          {__MODULE__, opts}
        )
    end
  end

  def start_watching(_project), do: {:error, :no_linked_path}

  # -- GenServer callbacks ----------------------------------------------------

  @impl true
  def init(opts) do
    project_id = Keyword.fetch!(opts, :project_id)
    linked_path = Keyword.fetch!(opts, :linked_path)

    paths =
      linked_path
      |> String.split(",")
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))
      |> Enum.map(&Path.expand/1)

    state = %{
      project_id: project_id,
      paths: paths,
      mtimes: snapshot_mtimes(paths)
    }

    schedule_poll()
    Logger.info("[SupermanWatcher] Watching #{project_id} — #{length(paths)} path(s)")
    {:ok, state}
  end

  @impl true
  def handle_info(:poll, state) do
    new_mtimes = snapshot_mtimes(state.paths)

    if new_mtimes != state.mtimes do
      Logger.info("[SupermanWatcher] Change detected for #{state.project_id}")

      Phoenix.PubSub.broadcast(
        Ema.PubSub,
        "superman:updated:#{state.project_id}",
        %{project_id: state.project_id}
      )
    end

    schedule_poll()
    {:noreply, %{state | mtimes: new_mtimes}}
  end

  # -- Private ----------------------------------------------------------------

  defp schedule_poll do
    Process.send_after(self(), :poll, @poll_interval_ms)
  end

  defp via(project_id) do
    {:via, Registry, {Ema.Intelligence.WatcherRegistry, {:superman_watcher, project_id}}}
  end

  defp snapshot_mtimes(paths) do
    Enum.flat_map(paths, fn base ->
      superman_path = Path.join(base, @superman_dir)

      if File.dir?(superman_path) do
        collect_mtimes(superman_path)
      else
        []
      end
    end)
    |> Map.new()
  end

  defp collect_mtimes(dir) do
    case File.ls(dir) do
      {:ok, entries} ->
        Enum.flat_map(entries, fn entry ->
          full = Path.join(dir, entry)

          case File.stat(full) do
            {:ok, %{type: :directory}} -> collect_mtimes(full)
            {:ok, %{mtime: mtime}} -> [{full, mtime}]
            _ -> []
          end
        end)

      _ ->
        []
    end
  end
end
