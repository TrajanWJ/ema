defmodule Ema.SecondBrain.VaultWatcher do
  @moduledoc """
  Watches the vault directory for file changes using a polling approach.
  Checks file mtimes every 5 seconds and updates the vault_notes index.
  Creates the vault directory structure on first boot.
  """

  use GenServer
  require Logger

  alias Ema.SecondBrain
  alias Ema.Superman.IntentParser

  @poll_interval 5_000

  @default_spaces ~w(research-ingestion projects user-preferences system)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  # --- Server Callbacks ---

  @impl true
  def init(_opts) do
    ensure_vault_structure()
    state = %{file_mtimes: scan_all_files()}
    schedule_poll()
    {:ok, state}
  end

  @impl true
  def handle_info(:poll, state) do
    new_mtimes = scan_all_files()
    changes = detect_changes(state.file_mtimes, new_mtimes)

    if changes != [] do
      Logger.info("VaultWatcher: detected #{length(changes)} file change(s)")
      process_changes(changes)
    end

    schedule_poll()
    {:noreply, %{state | file_mtimes: new_mtimes}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # --- Private ---

  defp schedule_poll do
    interval = Application.get_env(:ema, :vault_poll_interval, @poll_interval)
    Process.send_after(self(), :poll, interval)
  end

  defp ensure_vault_structure do
    root = SecondBrain.vault_root()

    Enum.each(@default_spaces, fn space ->
      path = Path.join(root, space)
      File.mkdir_p!(path)
    end)

    # Create system/state directory for SystemBrain
    File.mkdir_p!(Path.join([root, "system", "state"]))

    Logger.info("VaultWatcher: vault structure ensured at #{root}")
  end

  defp scan_all_files do
    root = SecondBrain.vault_root()

    if File.dir?(root) do
      root
      |> scan_directory()
      |> Map.new()
    else
      %{}
    end
  end

  defp scan_directory(dir) do
    case File.ls(dir) do
      {:ok, entries} ->
        entries
        |> Enum.reject(&(String.starts_with?(&1, ".") and not String.ends_with?(&1, ".superman")))
        |> Enum.flat_map(fn entry ->
          path = Path.join(dir, entry)

          cond do
            File.dir?(path) ->
              scan_directory(path)

            String.ends_with?(entry, ".md") or String.ends_with?(entry, ".superman") ->
              case File.stat(path) do
                {:ok, %{mtime: mtime}} -> [{path, mtime}]
                _ -> []
              end

            true ->
              []
          end
        end)

      {:error, _} ->
        []
    end
  end

  defp detect_changes(old_mtimes, new_mtimes) do
    old_keys = Map.keys(old_mtimes) |> MapSet.new()
    new_keys = Map.keys(new_mtimes) |> MapSet.new()

    created =
      new_keys
      |> MapSet.difference(old_keys)
      |> Enum.map(&{:created, &1})

    deleted =
      old_keys
      |> MapSet.difference(new_keys)
      |> Enum.map(&{:deleted, &1})

    modified =
      old_keys
      |> MapSet.intersection(new_keys)
      |> Enum.filter(fn key -> Map.get(old_mtimes, key) != Map.get(new_mtimes, key) end)
      |> Enum.map(&{:modified, &1})

    created ++ deleted ++ modified
  end

  defp process_changes(changes) do
    root = SecondBrain.vault_root()

    Enum.each(changes, fn
      {:created, full_path} ->
        process_file_change(full_path, root)

      {:modified, full_path} ->
        process_file_change(full_path, root)

      {:deleted, full_path} ->
        process_deleted_file(full_path, root)
    end)

    # Trigger graph rebuild after processing changes
    Ema.SecondBrain.GraphBuilder.rebuild()
  end

  defp process_file_change(full_path, root) do
    if String.ends_with?(full_path, ".superman") do
      sync_superman_file(full_path, root)
    else
      sync_file_to_db(full_path, root)
    end
  end

  defp process_deleted_file(full_path, root) do
    if String.ends_with?(full_path, ".superman") do
      case superman_project_id(full_path, root) do
        nil -> :ok
        project_id -> Ema.Superman.clear(project_id)
      end
    else
      relative = Path.relative_to(full_path, root)

      case SecondBrain.get_note_by_path(relative) do
        nil -> :ok
        note -> SecondBrain.delete_note(note.id)
      end
    end
  end

  defp sync_file_to_db(full_path, root) do
    relative = Path.relative_to(full_path, root)
    space = extract_space(relative)
    title = extract_title(full_path)

    case File.read(full_path) do
      {:ok, content} ->
        content_hash = :crypto.hash(:sha256, content) |> Base.encode16(case: :lower)

        case SecondBrain.get_note_by_path(relative) do
          nil ->
            # Only create DB entry — don't write file back (it already exists on disk)
            attrs = %{
              file_path: relative,
              title: title,
              space: space,
              content_hash: content_hash,
              source_type: "manual",
              word_count: content |> String.split(~r/\s+/, trim: true) |> length()
            }

            id = Ecto.UUID.generate()

            %Ema.SecondBrain.Note{}
            |> Ema.SecondBrain.Note.changeset(Map.put(attrs, :id, id))
            |> Ema.Repo.insert()

          note ->
            if note.content_hash != content_hash do
              note
              |> Ema.SecondBrain.Note.changeset(%{
                content_hash: content_hash,
                title: title,
                word_count: content |> String.split(~r/\s+/, trim: true) |> length()
              })
              |> Ema.Repo.update()
            end
        end

      {:error, _} ->
        :ok
    end
  end

  defp sync_superman_file(full_path, root) do
    with project_id when is_binary(project_id) <- superman_project_id(full_path, root),
         {:ok, content} <- File.read(full_path) do
      nodes = IntentParser.parse(content, source: full_path)
      Ema.Superman.ingest(nodes, project_id)
    else
      nil -> :ok
      {:error, _reason} -> :ok
    end
  end

  defp superman_project_id(full_path, root) do
    relative = Path.relative_to(full_path, root)

    case String.split(relative, "/", trim: true) do
      ["projects", project_slug | _rest] when project_slug != "" -> project_slug
      _ -> nil
    end
  end

  defp extract_space(relative_path) do
    case String.split(relative_path, "/", parts: 2) do
      [space, _rest] -> space
      _ -> nil
    end
  end

  defp extract_title(full_path) do
    case File.read(full_path) do
      {:ok, content} ->
        # Try to extract title from frontmatter or first heading
        cond do
          title = extract_frontmatter_title(content) -> title
          title = extract_heading(content) -> title
          true -> Path.basename(full_path, ".md")
        end

      _ ->
        Path.basename(full_path, ".md")
    end
  end

  defp extract_frontmatter_title(content) do
    case Regex.run(~r/\A---\n.*?title:\s*"?([^"\n]+)"?\n.*?---/s, content) do
      [_, title] -> String.trim(title)
      _ -> nil
    end
  end

  defp extract_heading(content) do
    case Regex.run(~r/^#\s+(.+)$/m, content) do
      [_, heading] -> String.trim(heading)
      _ -> nil
    end
  end
end
