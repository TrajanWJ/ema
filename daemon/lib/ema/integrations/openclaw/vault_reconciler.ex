defmodule Ema.Integrations.OpenClaw.VaultReconciler do
  @moduledoc """
  Full inventory reconcile every 15 minutes.

  Scans the local staging dir and compares against sync entries in DB.
  Marks missing files as stale (incrementing missing_count), and ensures
  all present files have up-to-date sync entries.
  """

  use GenServer
  require Logger

  alias Ema.Repo
  alias Ema.Integrations.OpenClaw.SyncEntry

  import Ecto.Query

  @default_interval 15 * 60_000
  @stale_threshold 3

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Force an immediate reconciliation."
  def reconcile do
    GenServer.cast(__MODULE__, :reconcile)
  end

  # --- Server Callbacks ---

  @impl true
  def init(_opts) do
    schedule_reconcile()
    {:ok, %{}}
  end

  @impl true
  def handle_cast(:reconcile, state) do
    do_reconcile()
    {:noreply, state}
  end

  @impl true
  def handle_info(:reconcile, state) do
    do_reconcile()
    schedule_reconcile()
    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # --- Private ---

  defp do_reconcile do
    config = sync_config()
    staging = Ema.Integrations.OpenClaw.VaultMirror.staging_dir()
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    # Get all files currently in staging
    local_files = scan_staging(staging) |> MapSet.new()

    # Get all sync entries for this integration + intent
    db_entries =
      SyncEntry
      |> where([e], e.integration == "openclaw" and e.intent_node_id == ^config.intent_node_id)
      |> Repo.all()

    db_paths = MapSet.new(db_entries, & &1.relative_path)

    # Files in staging but not in DB -> trigger sync
    new_paths = MapSet.difference(local_files, db_paths) |> MapSet.to_list()

    if new_paths != [] do
      Logger.info(
        "VaultReconciler: found #{length(new_paths)} untracked file(s), triggering sync"
      )

      Phoenix.PubSub.broadcast(
        Ema.PubSub,
        "openclaw:vault_mirror",
        {:mirror_changed, new_paths}
      )
    end

    # Entries in DB but not in staging -> increment missing_count
    missing_entries =
      Enum.filter(db_entries, fn entry ->
        not MapSet.member?(local_files, entry.relative_path)
      end)

    Enum.each(missing_entries, fn entry ->
      new_count = (entry.missing_count || 0) + 1

      new_status =
        if new_count >= @stale_threshold, do: "stale", else: entry.status

      entry
      |> SyncEntry.changeset(%{
        missing_count: new_count,
        status: new_status,
        last_seen_at: now
      })
      |> Repo.update()
    end)

    # Reset missing_count for entries that are present
    present_entries =
      Enum.filter(db_entries, fn entry ->
        MapSet.member?(local_files, entry.relative_path) and (entry.missing_count || 0) > 0
      end)

    Enum.each(present_entries, fn entry ->
      entry
      |> SyncEntry.changeset(%{missing_count: 0})
      |> Repo.update()
    end)

    stale_count =
      Enum.count(missing_entries, fn e -> (e.missing_count || 0) + 1 >= @stale_threshold end)

    if stale_count > 0 do
      Logger.info("VaultReconciler: #{stale_count} entry/entries marked stale")
    end

    Logger.debug(
      "VaultReconciler: reconciled #{MapSet.size(local_files)} local, " <>
        "#{length(db_entries)} tracked, #{length(new_paths)} new, #{length(missing_entries)} missing"
    )
  end

  defp scan_staging(dir) do
    if File.dir?(dir) do
      do_scan(dir, dir)
    else
      []
    end
  end

  defp do_scan(dir, root) do
    case File.ls(dir) do
      {:ok, entries} ->
        Enum.flat_map(entries, fn entry ->
          path = Path.join(dir, entry)

          cond do
            File.dir?(path) ->
              do_scan(path, root)

            String.ends_with?(entry, ".qmd") or String.ends_with?(entry, ".md") ->
              [Path.relative_to(path, root)]

            true ->
              []
          end
        end)

      {:error, _} ->
        []
    end
  end

  defp schedule_reconcile do
    interval =
      Application.get_env(:ema, :openclaw_vault_sync, [])
      |> Keyword.get(:reconcile_interval, @default_interval)

    Process.send_after(self(), :reconcile, interval)
  end

  defp sync_config do
    openclaw_vault = Application.get_env(:ema, :openclaw_vault_sync, [])

    %{
      intent_node_id: Keyword.get(openclaw_vault, :intent_node_id, "int_1775263900943_1678626d")
    }
  end
end
