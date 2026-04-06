defmodule Ema.Vault.VaultIndex do
  @moduledoc """
  Indexes the Obsidian vault at /home/trajan/vault for EMA to query.
  Provides filesystem-level search and read/write operations for vault notes.
  """

  # vault_path/0 resolves at runtime via Ema.Config — no compile_env needed

  # List all vault notes with metadata
  def list_notes(opts \\ []) do
    dir = Keyword.get(opts, :dir, vault_path())
    pattern = Keyword.get(opts, :pattern, "**/*.md")

    Path.wildcard(Path.join(dir, pattern))
    |> Enum.map(&read_note_meta/1)
    |> Enum.reject(&is_nil/1)
    |> Enum.sort_by(& &1.path)
  end

  # List recent notes (by mtime), limited to last N
  def list_recent(limit \\ 20) do
    dir = vault_path()

    Path.wildcard(Path.join(dir, "**/*.md"))
    |> Enum.map(fn path ->
      case File.stat(path) do
        {:ok, stat} -> {path, stat.mtime}
        _ -> nil
      end
    end)
    |> Enum.reject(&is_nil/1)
    |> Enum.sort_by(fn {_path, mtime} -> mtime end, :desc)
    |> Enum.take(limit)
    |> Enum.map(fn {path, _} -> read_note_meta(path) end)
    |> Enum.reject(&is_nil/1)
  end

  # Search notes by keyword (title + content preview)
  def search(query) do
    list_notes()
    |> Enum.filter(fn note ->
      q = String.downcase(query)

      String.contains?(String.downcase(note.title), q) or
        String.contains?(String.downcase(note.content || ""), q)
    end)
    |> Enum.take(20)
  end

  # Read a note's full content
  def get_note(path) do
    full_path =
      if String.starts_with?(path, "/") do
        path
      else
        Path.join(vault_path(), path)
      end

    case File.read(full_path) do
      {:ok, content} ->
        {frontmatter, body} = parse_frontmatter(content)
        relative = Path.relative_to(full_path, vault_path())

        {:ok,
         %{
           path: relative,
           title: Map.get(frontmatter, "title", Path.basename(relative, ".md")),
           tags: Map.get(frontmatter, "tags", []),
           type: Map.get(frontmatter, "type"),
           frontmatter: frontmatter,
           content: body
         }}

      err ->
        err
    end
  end

  # Write a note to the vault
  def write_note(relative_path, content) do
    full_path = Path.join(vault_path(), relative_path)
    File.mkdir_p!(Path.dirname(full_path))
    File.write(full_path, content)
  end

  def vault_path do
    Ema.Config.obsidian_vault_path()
  end

  # --- Private ---

  defp read_note_meta(path) do
    relative = Path.relative_to(path, vault_path())

    case File.read(path) do
      {:ok, content} ->
        {frontmatter, body} = parse_frontmatter(content)

        %{
          path: relative,
          title: Map.get(frontmatter, "title", Path.basename(relative, ".md")),
          tags: Map.get(frontmatter, "tags", []),
          type: Map.get(frontmatter, "type"),
          # preview only
          content: String.slice(body, 0, 500)
        }

      _ ->
        nil
    end
  end

  defp parse_frontmatter(content) do
    case String.split(content, ~r/^---\s*$/m, parts: 3) do
      ["", yaml, body] ->
        frontmatter = parse_yaml_simple(yaml)
        {frontmatter, String.trim(body)}

      _ ->
        {%{}, content}
    end
  end

  defp parse_yaml_simple(yaml) do
    yaml
    |> String.split("\n")
    |> Enum.reduce(%{}, fn line, acc ->
      case String.split(line, ": ", parts: 2) do
        [key, value] -> Map.put(acc, String.trim(key), String.trim(value))
        _ -> acc
      end
    end)
  end
end
