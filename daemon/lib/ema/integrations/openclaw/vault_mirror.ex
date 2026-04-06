defmodule Ema.Integrations.OpenClaw.VaultMirror do
  @moduledoc """
  Periodically rsyncs a remote QMD vault intent node into a local staging
  directory. Falls back to SSH manifest scan if rsync is unavailable.

  Staging dir: `var/openclaw_mirror/<intent_node_id>/`
  Interval: 30 seconds (configurable).

  After each sync, publishes changed file paths to PubSub so VaultSync
  can pick them up.
  """

  use GenServer
  require Logger

  @default_interval 30_000
  @pubsub_topic "openclaw:vault_mirror"

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Force an immediate mirror refresh."
  def refresh do
    GenServer.cast(__MODULE__, :refresh)
  end

  @doc "Returns the local staging directory for the configured intent node."
  def staging_dir do
    config = sync_config()
    Path.join([staging_root(), config.intent_node_id])
  end

  # --- Server Callbacks ---

  @impl true
  def init(_opts) do
    config = sync_config()

    state = %{
      config: config,
      last_manifest: %{},
      consecutive_failures: 0
    }

    File.mkdir_p!(staging_dir())
    schedule_refresh(config.interval)
    Logger.info("VaultMirror: started for #{config.intent_node_id} on #{config.source_host}")

    {:ok, state}
  end

  @impl true
  def handle_cast(:refresh, state) do
    {:noreply, do_refresh(state)}
  end

  @impl true
  def handle_info(:refresh, state) do
    new_state = do_refresh(state)
    schedule_refresh(new_state.config.interval)
    {:noreply, new_state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # --- Private ---

  defp do_refresh(state) do
    case run_rsync(state.config) do
      {:ok, changed_paths} ->
        if changed_paths != [] do
          Logger.info("VaultMirror: rsync found #{length(changed_paths)} changed file(s)")
          broadcast_changes(changed_paths)
        end

        %{state | last_manifest: build_manifest(), consecutive_failures: 0}

      {:error, :rsync_unavailable} ->
        Logger.debug("VaultMirror: rsync unavailable, falling back to SSH manifest")
        fallback_ssh_manifest(state)

      {:error, reason} ->
        failures = state.consecutive_failures + 1
        Logger.warning("VaultMirror: rsync failed (#{failures}x): #{inspect(reason)}")
        %{state | consecutive_failures: failures}
    end
  end

  defp run_rsync(config) do
    case System.find_executable("rsync") do
      nil ->
        {:error, :rsync_unavailable}

      rsync_path ->
        source = "#{config.source_host}:#{config.source_root}/"
        dest = Path.join([staging_root(), config.intent_node_id]) <> "/"

        args = [
          "--archive",
          "--delete",
          "--itemize-changes",
          "--include=*.qmd",
          "--include=*.md",
          "--include=*/",
          "--exclude=*",
          "-e",
          "ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no",
          source,
          dest
        ]

        case System.cmd(rsync_path, args, stderr_to_stdout: true, timeout: 60_000) do
          {output, 0} ->
            changed = parse_rsync_itemize(output)
            {:ok, changed}

          {output, code} ->
            {:error, {:exit_code, code, String.slice(output, 0, 500)}}
        end
    end
  rescue
    e -> {:error, {:exception, Exception.message(e)}}
  end

  defp parse_rsync_itemize(output) do
    # rsync --itemize-changes outputs lines like ">f..t...... path/to/file.qmd"
    # We extract file paths from lines that indicate a change.
    output
    |> String.split("\n", trim: true)
    |> Enum.filter(&Regex.match?(~r/^[><ch.]f/, &1))
    |> Enum.map(fn line ->
      # The path starts after the first space following the change indicator
      case String.split(line, " ", parts: 2) do
        [_indicator, path] -> String.trim(path)
        _ -> nil
      end
    end)
    |> Enum.reject(&is_nil/1)
  end

  defp fallback_ssh_manifest(state) do
    config = state.config

    case ssh_ls(config.source_host, config.source_root) do
      {:ok, remote_files} ->
        local_files = build_manifest()

        changed =
          remote_files
          |> Enum.filter(fn {path, mtime} ->
            case Map.get(local_files, path) do
              nil -> true
              local_mtime -> mtime != local_mtime
            end
          end)
          |> Enum.map(fn {path, _} -> path end)

        # For changed files, scp them individually
        Enum.each(changed, fn path ->
          scp_file(config.source_host, Path.join(config.source_root, path), path, config)
        end)

        if changed != [] do
          Logger.info("VaultMirror: SSH manifest found #{length(changed)} changed file(s)")
          broadcast_changes(changed)
        end

        %{state | last_manifest: build_manifest(), consecutive_failures: 0}

      {:error, reason} ->
        failures = state.consecutive_failures + 1
        Logger.warning("VaultMirror: SSH manifest failed (#{failures}x): #{inspect(reason)}")
        %{state | consecutive_failures: failures}
    end
  end

  defp ssh_ls(host, remote_root) do
    cmd =
      "find #{remote_root} -type f \\( -name '*.qmd' -o -name '*.md' \\) -printf '%P\\t%T@\\n'"

    case System.cmd("ssh", ["-o", "ConnectTimeout=10", host, cmd],
           stderr_to_stdout: true,
           timeout: 30_000
         ) do
      {output, 0} ->
        files =
          output
          |> String.split("\n", trim: true)
          |> Enum.map(fn line ->
            case String.split(line, "\t", parts: 2) do
              [path, mtime_str] ->
                mtime = mtime_str |> String.trim() |> String.to_float() |> trunc()
                {path, mtime}

              _ ->
                nil
            end
          end)
          |> Enum.reject(&is_nil/1)
          |> Map.new()

        {:ok, files}

      {output, code} ->
        {:error, {:ssh_exit, code, String.slice(output, 0, 500)}}
    end
  rescue
    e -> {:error, {:exception, Exception.message(e)}}
  end

  defp scp_file(host, remote_path, relative_path, config) do
    local_path = Path.join([staging_root(), config.intent_node_id, relative_path])
    File.mkdir_p!(Path.dirname(local_path))

    System.cmd(
      "scp",
      [
        "-o",
        "ConnectTimeout=10",
        "#{host}:#{remote_path}",
        local_path
      ],
      stderr_to_stdout: true,
      timeout: 30_000
    )
  end

  defp build_manifest do
    dir = staging_dir()

    if File.dir?(dir) do
      dir
      |> scan_files()
      |> Map.new()
    else
      %{}
    end
  end

  defp scan_files(dir) do
    case File.ls(dir) do
      {:ok, entries} ->
        Enum.flat_map(entries, fn entry ->
          path = Path.join(dir, entry)

          cond do
            File.dir?(path) ->
              scan_files(path)

            String.ends_with?(entry, ".qmd") or String.ends_with?(entry, ".md") ->
              case File.stat(path, time: :posix) do
                {:ok, %{mtime: mtime}} ->
                  relative = Path.relative_to(path, staging_dir())
                  [{relative, mtime}]

                _ ->
                  []
              end

            true ->
              []
          end
        end)

      {:error, _} ->
        []
    end
  end

  defp broadcast_changes(paths) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      @pubsub_topic,
      {:mirror_changed, paths}
    )
  end

  defp schedule_refresh(interval) do
    Process.send_after(self(), :refresh, interval)
  end

  defp sync_config do
    openclaw_vault = Application.get_env(:ema, :openclaw_vault_sync, [])

    %{
      source_host: Keyword.get(openclaw_vault, :source_host, "192.168.122.10"),
      source_root:
        Keyword.get(
          openclaw_vault,
          :source_root,
          "projects/openclaw/intents/int_1775263900943_1678626d"
        ),
      intent_node_id: Keyword.get(openclaw_vault, :intent_node_id, "int_1775263900943_1678626d"),
      interval: Keyword.get(openclaw_vault, :interval, @default_interval)
    }
  end

  defp staging_root do
    Application.get_env(:ema, :openclaw_vault_sync, [])
    |> Keyword.get(:staging_root, Path.join([File.cwd!(), "var", "openclaw_mirror"]))
  end
end
