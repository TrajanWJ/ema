defmodule Ema.Intelligence.WikiSync do
  @moduledoc """
  Analyzes git events and generates wiki sync suggestions.
  Finds existing wiki pages that reference changed files/modules,
  flags outdated pages, and creates stubs for new modules.
  """

  require Logger

  alias Ema.Intelligence
  alias Ema.Intelligence.GitEvent

  @doc """
  Analyze a git event and create sync action suggestions.
  Called async from GitWatcher after a commit is recorded.
  """
  def analyze(%GitEvent{} = event) do
    event = Ema.Repo.preload(event, :sync_actions)
    changed = extract_file_paths(event.changed_files)

    suggestions =
      find_outdated_wiki_pages(changed) ++ suggest_new_stubs(changed, event.repo_path)

    Enum.each(suggestions, fn suggestion ->
      attrs = Map.put(suggestion, "git_event_id", event.id)

      case Intelligence.create_sync_action(attrs) do
        {:ok, _action} ->
          :ok

        {:error, reason} ->
          Logger.warning("[WikiSync] Failed to create action: #{inspect(reason)}")
      end
    end)

    Logger.info(
      "[WikiSync] Generated #{length(suggestions)} suggestions for #{String.slice(event.commit_sha, 0, 8)}"
    )

    {:ok, length(suggestions)}
  end

  @doc """
  Apply a sync action — execute the suggestion (create stub or flag page).
  """
  def apply_action(action_id) do
    case Intelligence.apply_sync_action(action_id) do
      {:ok, action} ->
        case action.action_type do
          "create_stub" -> create_wiki_stub(action)
          "flag_outdated" -> flag_wiki_page(action)
          "update_content" -> :ok
          _ -> :ok
        end

        {:ok, action}

      error ->
        error
    end
  end

  # ── Private ──

  defp extract_file_paths(%{"files" => files}) when is_list(files) do
    Enum.map(files, fn
      %{"path" => path} -> path
      _ -> nil
    end)
    |> Enum.reject(&is_nil/1)
  end

  defp extract_file_paths(_), do: []

  defp find_outdated_wiki_pages(changed_paths) do
    vault_notes = list_vault_notes()

    Enum.flat_map(changed_paths, fn path ->
      module_name = extract_module_name(path)
      basename = Path.basename(path, Path.extname(path))

      vault_notes
      |> Enum.filter(fn note ->
        content = note.content || ""
        title = note.title || ""

        String.contains?(content, path) or
          String.contains?(content, basename) or
          (module_name && String.contains?(content, module_name)) or
          String.contains?(title, basename)
      end)
      |> Enum.map(fn note ->
        %{
          "action_type" => "flag_outdated",
          "wiki_path" => note.file_path,
          "suggestion" =>
            "File `#{path}` was modified. Wiki page '#{note.title || note.file_path}' references this file and may need updating."
        }
      end)
    end)
    |> Enum.uniq_by(& &1["wiki_path"])
  end

  defp suggest_new_stubs(changed_paths, repo_path) do
    vault_notes = list_vault_notes()
    existing_paths = MapSet.new(vault_notes, & &1.file_path)

    changed_paths
    |> Enum.filter(&new_module_file?/1)
    |> Enum.reject(fn path ->
      # Skip if a wiki page already exists for this module
      basename = Path.basename(path, Path.extname(path))
      Enum.any?(existing_paths, fn wp -> String.contains?(wp, basename) end)
    end)
    |> Enum.map(fn path ->
      space = infer_space(path, repo_path)
      module_name = extract_module_name(path) || Path.basename(path, Path.extname(path))

      %{
        "action_type" => "create_stub",
        "wiki_path" => "#{space}/#{module_name}.md",
        "suggestion" =>
          "New file `#{path}` detected. Create a wiki stub for module '#{module_name}' in the #{space} space."
      }
    end)
  end

  defp new_module_file?(path) do
    ext = Path.extname(path)

    ext in ~w(.ex .exs .ts .tsx .rs .py .go .rb) and
      not String.contains?(path, "test") and
      not String.contains?(path, "spec") and
      not String.contains?(path, "migration")
  end

  defp extract_module_name(path) do
    cond do
      String.ends_with?(path, ".ex") or String.ends_with?(path, ".exs") ->
        path
        |> Path.basename(".ex")
        |> Path.basename(".exs")
        |> Macro.camelize()

      String.ends_with?(path, ".ts") or String.ends_with?(path, ".tsx") ->
        path
        |> Path.basename(".tsx")
        |> Path.basename(".ts")
        |> then(fn name ->
          name
          |> String.split("-")
          |> Enum.map_join(&String.capitalize/1)
        end)

      true ->
        nil
    end
  end

  defp infer_space(path, repo_path) do
    relative = String.replace_prefix(path, repo_path <> "/", "")

    cond do
      String.starts_with?(relative, "daemon/") -> "backend"
      String.starts_with?(relative, "app/src/") -> "frontend"
      String.starts_with?(relative, "app/src-tauri/") -> "tauri"
      true -> "general"
    end
  end

  defp list_vault_notes do
    try do
      Ema.SecondBrain.list_notes()
    rescue
      _ -> []
    end
  end

  defp create_wiki_stub(action) do
    vault_dir = Ema.Config.vault_path()
    full_path = Path.join(vault_dir, action.wiki_path)

    dir = Path.dirname(full_path)
    File.mkdir_p!(dir)

    unless File.exists?(full_path) do
      content = """
      # #{Path.basename(action.wiki_path, ".md")}

      > Auto-generated stub from git commit. Flesh out with implementation details.

      ## Overview

      #{action.suggestion}

      ## References

      - Source file linked from git event

      ## Tags

      #auto-generated #stub
      """

      File.write!(full_path, content)
      Logger.info("[WikiSync] Created stub: #{action.wiki_path}")
    end
  end

  defp flag_wiki_page(action) do
    Logger.info("[WikiSync] Flagged outdated: #{action.wiki_path}")
  end
end
