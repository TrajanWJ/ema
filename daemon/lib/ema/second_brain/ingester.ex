defmodule Ema.SecondBrain.Ingester do
  @moduledoc """
  Ingests markdown files into the Second Brain.

  Reads markdown files, extracts title + tags from YAML frontmatter (or derives
  them from the filename), creates/updates `Ema.SecondBrain.Note` records, and
  schedules FTS5 indexing via `Ema.SecondBrain.Indexer`.

  ## Usage

      # Ingest a single file
      {:ok, note} = Ema.SecondBrain.Ingester.ingest_file("/path/to/note.md")

      # Ingest a directory recursively
      {:ok, stats} = Ema.SecondBrain.Ingester.ingest_directory("/path/to/dir")

      # Bootstrap from EMA docs + vault
      {:ok, stats} = Ema.SecondBrain.Ingester.ingest_vault()
  """

  require Logger

  alias Ema.SecondBrain
  alias Ema.SecondBrain.Indexer

  @doc """
  Ingest a single markdown file into the Second Brain.

  Reads the file, parses YAML frontmatter for metadata, then creates or updates
  a `vault_note` record. The file path stored is relative to the vault root.

  Returns `{:ok, note}` on success or `{:error, reason}`.
  """
  @spec ingest_file(String.t()) :: {:ok, map()} | {:error, term()}
  def ingest_file(path) when is_binary(path) do
    with {:ok, raw} <- File.read(path),
         {:ok, meta, body} <- parse_markdown(raw, path) do
      vault_root = SecondBrain.vault_root()

      relative_path =
        if String.starts_with?(path, vault_root) do
          Path.relative_to(path, vault_root)
        else
          # File is outside vault root — store under ingestion/
          base = Path.basename(path)
          "ingestion/#{base}"
        end

      attrs = %{
        "file_path" => relative_path,
        "title" => meta[:title],
        "space" => meta[:space] || derive_space(relative_path),
        "tags" => meta[:tags] || [],
        "source_type" => "ingestion",
        "metadata" => Map.get(meta, :extra, %{})
      }

      case SecondBrain.get_note_by_path(relative_path) do
        nil ->
          create_without_write(attrs, body)

        existing ->
          new_hash = :crypto.hash(:sha256, raw) |> Base.encode16(case: :lower)

          if existing.content_hash == new_hash do
            {:ok, existing}
          else
            update_note_no_write(existing, attrs, raw)
          end
      end
    else
      {:error, reason} ->
        Logger.warning("SecondBrain.Ingester: failed to ingest #{path}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  Ingest all `.md` files in a directory, recursively.

  ## Options
    - `:space` — override the space for all ingested notes
    - `:dry_run` — if true, count files without inserting (default: false)

  Returns `{:ok, %{ingested: n, skipped: n, errors: [...]}}`.
  """
  @spec ingest_directory(String.t(), keyword()) :: {:ok, map()}
  def ingest_directory(dir_path, opts \\ []) do
    dry_run = Keyword.get(opts, :dry_run, false)

    md_files =
      dir_path
      |> find_markdown_files()
      |> Enum.filter(&File.regular?/1)

    if dry_run do
      {:ok, %{ingested: length(md_files), skipped: 0, errors: []}}
    else
      results =
        Enum.map(md_files, fn path ->
          case ingest_file(path) do
            {:ok, _note} -> :ingested
            {:error, _} = err -> err
          end
        end)

      ingested = Enum.count(results, &(&1 == :ingested))
      errors = Enum.filter(results, &match?({:error, _}, &1))
      skipped = length(md_files) - ingested - length(errors)

      Logger.info(
        "SecondBrain.Ingester: #{dir_path} => ingested=#{ingested} skipped=#{skipped} errors=#{length(errors)}"
      )

      {:ok, %{ingested: ingested, skipped: skipped, errors: errors}}
    end
  end

  @doc """
  Bootstrap the Second Brain from EMA's built-in docs directory and any
  configured vault paths.

  Ingests:
    1. `~/Projects/ema/docs/` — EMA's own documentation
    2. The EMA vault root (`Ema.Config.vault_path()`)

  Returns `{:ok, %{ingested: n, skipped: n, errors: [...]}}`.
  """
  @spec ingest_vault() :: {:ok, map()}
  def ingest_vault do
    sources = build_source_list()

    Logger.info("SecondBrain.Ingester.ingest_vault: sources=#{inspect(sources)}")

    totals =
      Enum.reduce(sources, %{ingested: 0, skipped: 0, errors: []}, fn dir, acc ->
        case ingest_directory(dir) do
          {:ok, stats} ->
            %{
              acc
              | ingested: acc.ingested + stats.ingested,
                skipped: acc.skipped + stats.skipped,
                errors: acc.errors ++ stats.errors
            }
        end
      end)

    Logger.info(
      "SecondBrain.Ingester.ingest_vault: complete — ingested=#{totals.ingested} " <>
        "skipped=#{totals.skipped} errors=#{length(totals.errors)}"
    )

    {:ok, totals}
  end

  # ---------------------------------------------------------------------------
  # Private helpers
  # ---------------------------------------------------------------------------

  defp build_source_list do
    vault_root = Ema.Config.vault_path()

    # EMA project docs
    ema_docs =
      [
        Path.expand("~/Projects/ema/docs"),
        Path.join(Path.expand("~/Projects/ema/daemon"), "docs")
      ]
      |> Enum.filter(&File.dir?/1)

    # Application-configured extra ingest paths
    extra_paths =
      Application.get_env(:ema, :brain_ingest_paths, [])
      |> Enum.filter(&File.dir?/1)

    # Vault root itself
    vault_sources =
      if File.dir?(vault_root), do: [vault_root], else: []

    (ema_docs ++ vault_sources ++ extra_paths)
    |> Enum.uniq()
  end

  defp find_markdown_files(dir) do
    case File.ls(dir) do
      {:ok, entries} ->
        Enum.flat_map(entries, fn entry ->
          path = Path.join(dir, entry)

          cond do
            String.starts_with?(entry, ".") -> []
            File.dir?(path) -> find_markdown_files(path)
            String.ends_with?(entry, ".md") -> [path]
            true -> []
          end
        end)

      {:error, _} ->
        []
    end
  end

  defp parse_markdown(raw, path) do
    case Regex.run(~r/\A---\r?\n(.*?)\r?\n---\r?\n(.*)/ms, raw, capture: :all_but_first) do
      [fm_str, body] ->
        meta = parse_frontmatter(fm_str, path)
        {:ok, meta, body}

      nil ->
        meta = derive_meta_from_path(path)
        {:ok, meta, raw}
    end
  end

  defp parse_frontmatter(fm_str, path) do
    lines = String.split(fm_str, "\n")
    base = derive_meta_from_path(path)

    Enum.reduce(lines, base, fn line, acc ->
      case String.split(line, ":", parts: 2) do
        [key, value] ->
          key = String.trim(key)
          value = String.trim(value)

          case key do
            "title" ->
              Map.put(acc, :title, unquote_yaml(value))

            "tags" ->
              Map.put(acc, :tags, parse_yaml_list(value))

            "space" ->
              Map.put(acc, :space, unquote_yaml(value))

            _ ->
              extra = Map.get(acc, :extra, %{})
              Map.put(acc, :extra, Map.put(extra, key, value))
          end

        _ ->
          acc
      end
    end)
  end

  defp unquote_yaml(str) do
    str
    |> String.trim()
    |> String.trim_leading("\"")
    |> String.trim_trailing("\"")
    |> String.trim_leading("'")
    |> String.trim_trailing("'")
  end

  defp parse_yaml_list(value) do
    value = String.trim(value)

    cond do
      String.starts_with?(value, "[") ->
        value
        |> String.slice(1..-2//1)
        |> String.split(",")
        |> Enum.map(&String.trim/1)
        |> Enum.map(&unquote_yaml/1)
        |> Enum.reject(&(&1 == ""))

      String.contains?(value, ",") ->
        value
        |> String.split(",")
        |> Enum.map(&String.trim/1)
        |> Enum.reject(&(&1 == ""))

      value == "" ->
        []

      true ->
        [unquote_yaml(value)]
    end
  end

  defp derive_meta_from_path(path) do
    basename = Path.basename(path, ".md")
    title = basename |> String.replace(["-", "_"], " ") |> String.capitalize()
    %{title: title, tags: [], space: nil, extra: %{}}
  end

  defp derive_space(relative_path) do
    case String.split(relative_path, "/", parts: 2) do
      [space, _] -> space
      _ -> nil
    end
  end

  defp create_without_write(attrs, body) do
    id = Ecto.UUID.generate()
    hash = :crypto.hash(:sha256, body) |> Base.encode16(case: :lower)
    word_count = body |> String.split(~r/\s+/, trim: true) |> length()

    full_attrs =
      attrs
      |> Map.put("id", id)
      |> Map.put("content_hash", hash)
      |> Map.put("word_count", word_count)

    result =
      %Ema.SecondBrain.Note{}
      |> Ema.SecondBrain.Note.changeset(full_attrs)
      |> Ema.Repo.insert()

    case result do
      {:ok, note} ->
        Task.start(fn -> Indexer.index_note(note) end)
        {:ok, note}

      error ->
        error
    end
  end

  defp update_note_no_write(existing, attrs, raw) do
    hash = :crypto.hash(:sha256, raw) |> Base.encode16(case: :lower)
    word_count = raw |> String.split(~r/\s+/, trim: true) |> length()

    update_attrs =
      attrs
      |> Map.put("content_hash", hash)
      |> Map.put("word_count", word_count)

    result =
      existing
      |> Ema.SecondBrain.Note.changeset(update_attrs)
      |> Ema.Repo.update()

    case result do
      {:ok, note} ->
        Task.start(fn -> Indexer.index_note(note) end)
        {:ok, note}

      error ->
        error
    end
  end
end
