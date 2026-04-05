defmodule Ema.Integrations.OpenClaw.VaultSync do
  @moduledoc """
  Consumes staging deltas from VaultMirror, debounces for 3 seconds,
  then batches note upserts into SecondBrain.

  Transformation:
    - `.qmd` files treated as markdown with YAML frontmatter
    - Synced notes use `source_type: "ingestion"`
    - `source_id: "openclaw:<intent_node_id>:<relative_path>"`

  Idempotency keyed on (source_host, source_root, relative_path), not checksum.
  Checksum is for change detection only.
  """

  use GenServer
  require Logger

  alias Ema.Repo
  alias Ema.SecondBrain
  alias Ema.Integrations.OpenClaw.SyncEntry

  @debounce_ms 3_000
  @pubsub_topic "openclaw:vault_mirror"

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Force processing of all pending files in staging dir."
  def flush do
    GenServer.call(__MODULE__, :flush, 30_000)
  end

  # --- Server Callbacks ---

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, @pubsub_topic)

    state = %{
      pending_paths: MapSet.new(),
      debounce_ref: nil
    }

    {:ok, state}
  end

  @impl true
  def handle_info({:mirror_changed, paths}, state) do
    new_pending = Enum.reduce(paths, state.pending_paths, &MapSet.put(&2, &1))

    # Cancel existing debounce timer and start a new one
    if state.debounce_ref, do: Process.cancel_timer(state.debounce_ref)
    ref = Process.send_after(self(), :process_batch, @debounce_ms)

    {:noreply, %{state | pending_paths: new_pending, debounce_ref: ref}}
  end

  @impl true
  def handle_info(:process_batch, state) do
    paths = MapSet.to_list(state.pending_paths)

    if paths != [] do
      Logger.info("VaultSync: processing batch of #{length(paths)} file(s)")
      process_files(paths)
    end

    {:noreply, %{state | pending_paths: MapSet.new(), debounce_ref: nil}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  @impl true
  def handle_call(:flush, _from, state) do
    # Process any pending + scan staging dir for everything
    staging = Ema.Integrations.OpenClaw.VaultMirror.staging_dir()
    all_paths = scan_staging(staging)
    process_files(all_paths)
    {:reply, :ok, %{state | pending_paths: MapSet.new(), debounce_ref: nil}}
  end

  # --- Private ---

  defp process_files(paths) do
    config = sync_config()
    staging = Ema.Integrations.OpenClaw.VaultMirror.staging_dir()
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    Enum.each(paths, fn relative_path ->
      full_path = Path.join(staging, relative_path)

      case File.read(full_path) do
        {:ok, raw_content} ->
          upsert_file(relative_path, raw_content, full_path, config, now)

        {:error, reason} ->
          Logger.warning("VaultSync: failed to read #{relative_path}: #{inspect(reason)}")
          mark_error(relative_path, config, "read_failed: #{inspect(reason)}", now)
      end
    end)
  end

  defp upsert_file(relative_path, raw_content, full_path, config, now) do
    checksum = :crypto.hash(:sha256, raw_content) |> Base.encode16(case: :lower)
    {frontmatter, body} = parse_qmd(raw_content)
    title = extract_title(frontmatter, body, relative_path)
    mtime = file_mtime(full_path)

    # Find or create sync entry
    entry = find_or_init_entry(relative_path, config)

    # Skip if checksum unchanged
    if entry.id && entry.source_checksum == checksum do
      # Just update last_seen_at
      entry
      |> SyncEntry.changeset(%{last_seen_at: now})
      |> Repo.update()
    else
      # Upsert the vault note
      source_id = "openclaw:#{config.intent_node_id}:#{relative_path}"
      vault_file_path = "projects/openclaw/intents/#{config.intent_node_id}/#{relative_path}"
      # Normalize .qmd extension to .md for vault path
      vault_file_path = String.replace_suffix(vault_file_path, ".qmd", ".md")

      note_result = upsert_vault_note(vault_file_path, title, body, source_id, frontmatter)

      case note_result do
        {:ok, note} ->
          entry_attrs = %{
            integration: "openclaw",
            intent_node_id: config.intent_node_id,
            source_host: config.source_host,
            source_root: config.source_root,
            relative_path: relative_path,
            source_checksum: checksum,
            source_mtime: mtime,
            last_seen_at: now,
            last_synced_at: now,
            status: "synced",
            last_error: nil,
            vault_note_id: note.id,
            missing_count: 0
          }

          upsert_sync_entry(entry, entry_attrs)

        {:error, reason} ->
          Logger.warning("VaultSync: note upsert failed for #{relative_path}: #{inspect(reason)}")
          mark_error(relative_path, config, "note_upsert: #{inspect(reason)}", now)
      end
    end
  end

  defp upsert_vault_note(file_path, title, body, source_id, frontmatter) do
    space_name =
      case String.split(file_path, "/", parts: 2) do
        [s, _] -> s
        _ -> "projects"
      end

    tags = Map.get(frontmatter, "tags", [])
    tags = if is_list(tags), do: tags, else: []

    case SecondBrain.get_note_by_path(file_path) do
      nil ->
        SecondBrain.create_note(%{
          file_path: file_path,
          title: title,
          space: space_name,
          source_type: "ingestion",
          source_id: source_id,
          tags: tags,
          content: body,
          metadata: frontmatter
        })

      existing ->
        SecondBrain.update_note(existing.id, %{
          title: title,
          source_type: "ingestion",
          source_id: source_id,
          tags: tags,
          content: body,
          metadata: frontmatter
        })
    end
  end

  defp find_or_init_entry(relative_path, config) do
    case Repo.get_by(SyncEntry,
           integration: "openclaw",
           intent_node_id: config.intent_node_id,
           source_host: config.source_host,
           source_root: config.source_root,
           relative_path: relative_path
         ) do
      nil -> %SyncEntry{}
      entry -> entry
    end
  end

  defp upsert_sync_entry(%SyncEntry{id: nil}, attrs) do
    %SyncEntry{}
    |> SyncEntry.changeset(Map.put(attrs, :id, Ecto.UUID.generate()))
    |> Repo.insert()
  end

  defp upsert_sync_entry(entry, attrs) do
    entry
    |> SyncEntry.changeset(attrs)
    |> Repo.update()
  end

  defp mark_error(relative_path, config, error_msg, now) do
    entry = find_or_init_entry(relative_path, config)

    attrs = %{
      integration: "openclaw",
      intent_node_id: config.intent_node_id,
      source_host: config.source_host,
      source_root: config.source_root,
      relative_path: relative_path,
      last_seen_at: now,
      status: "error",
      last_error: error_msg
    }

    upsert_sync_entry(entry, attrs)
  end

  defp parse_qmd(content) do
    case Regex.run(~r/\A---\n(.*?)---\n?(.*)/s, content) do
      [_full, yaml_str, body] ->
        frontmatter = parse_yaml_frontmatter(yaml_str)
        {frontmatter, String.trim(body)}

      _ ->
        {%{}, String.trim(content)}
    end
  end

  defp parse_yaml_frontmatter(yaml_str) do
    # Simple key: value parser for YAML frontmatter
    yaml_str
    |> String.split("\n", trim: true)
    |> Enum.reduce(%{}, fn line, acc ->
      case Regex.run(~r/^(\w[\w-]*):\s*(.*)$/, String.trim(line)) do
        [_, key, value] ->
          parsed_value = parse_yaml_value(String.trim(value))
          Map.put(acc, key, parsed_value)

        _ ->
          acc
      end
    end)
  end

  defp parse_yaml_value("true"), do: true
  defp parse_yaml_value("false"), do: false
  defp parse_yaml_value("null"), do: nil
  defp parse_yaml_value("~"), do: nil

  defp parse_yaml_value(value) do
    # Try to parse as JSON array (e.g., [tag1, tag2])
    cond do
      String.starts_with?(value, "[") && String.ends_with?(value, "]") ->
        inner = String.slice(value, 1..-2//1)

        inner
        |> String.split(",", trim: true)
        |> Enum.map(&String.trim/1)
        |> Enum.map(&strip_quotes/1)

      String.starts_with?(value, "\"") && String.ends_with?(value, "\"") ->
        strip_quotes(value)

      String.starts_with?(value, "'") && String.ends_with?(value, "'") ->
        String.slice(value, 1..-2//1)

      true ->
        case Integer.parse(value) do
          {int, ""} -> int
          _ -> value
        end
    end
  end

  defp strip_quotes(s) do
    s
    |> String.trim_leading("\"")
    |> String.trim_trailing("\"")
    |> String.trim_leading("'")
    |> String.trim_trailing("'")
  end

  defp extract_title(frontmatter, body, relative_path) do
    cond do
      title = frontmatter["title"] ->
        to_string(title)

      match = Regex.run(~r/^#\s+(.+)$/m, body) ->
        Enum.at(match, 1) |> String.trim()

      true ->
        relative_path
        |> Path.basename()
        |> String.replace_suffix(".qmd", "")
        |> String.replace_suffix(".md", "")
    end
  end

  defp file_mtime(path) do
    case File.stat(path, time: :posix) do
      {:ok, %{mtime: mtime}} ->
        DateTime.from_unix!(mtime) |> DateTime.truncate(:second)

      _ ->
        nil
    end
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

  defp sync_config do
    openclaw_vault = Application.get_env(:ema, :openclaw_vault_sync, [])

    %{
      source_host: Keyword.get(openclaw_vault, :source_host, "192.168.122.10"),
      source_root: Keyword.get(
        openclaw_vault,
        :source_root,
        "projects/openclaw/intents/int_1775263900943_1678626d"
      ),
      intent_node_id: Keyword.get(openclaw_vault, :intent_node_id, "int_1775263900943_1678626d")
    }
  end
end
