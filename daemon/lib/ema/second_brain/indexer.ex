defmodule Ema.SecondBrain.Indexer do
  @moduledoc """
  Full-text search indexer for Second Brain vault notes.

  Uses SQLite FTS5 virtual table (`vault_notes_fts`) for fast ranked search
  over note titles, tags, and content. Content is read from disk (vault files)
  at index time.

  ## Usage

      # Index a single note (called automatically after create/update)
      Ema.SecondBrain.Indexer.index_note(note)

      # Search across all indexed notes
      {:ok, results} = Ema.SecondBrain.Indexer.search("elixir genserver")

      # Rebuild the entire index from scratch
      Ema.SecondBrain.Indexer.reindex_all()
  """

  require Logger

  alias Ema.Repo
  alias Ema.SecondBrain.Note

  import Ecto.Query

  # ---------------------------------------------------------------------------
  # Public API
  # ---------------------------------------------------------------------------

  @doc """
  Indexes a single note into the FTS5 table.
  Reads file content from disk. Safe to call repeatedly — upserts by note_id.
  """
  @spec index_note(Note.t()) :: :ok | {:error, term()}
  def index_note(%Note{} = note) do
    content = read_content(note)
    tags_text = Enum.join(note.tags || [], " ")

    Repo.transaction(fn ->
      # Remove existing entry
      Repo.query!(
        "DELETE FROM vault_notes_fts WHERE note_id = ?",
        [note.id]
      )

      # Insert fresh entry
      Repo.query!(
        """
        INSERT INTO vault_notes_fts (note_id, title, tags, file_path, content)
        VALUES (?, ?, ?, ?, ?)
        """,
        [note.id, note.title || "", tags_text, note.file_path || "", content]
      )
    end)
    |> case do
      {:ok, _} ->
        :ok

      {:error, reason} ->
        Logger.warning("SecondBrain.Indexer: failed to index note #{note.id}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  Removes a note from the FTS index.
  """
  @spec remove_note(String.t()) :: :ok
  def remove_note(note_id) when is_binary(note_id) do
    Repo.query!("DELETE FROM vault_notes_fts WHERE note_id = ?", [note_id])
    :ok
  rescue
    e ->
      Logger.warning("SecondBrain.Indexer: failed to remove note #{note_id}: #{inspect(e)}")
      :ok
  end

  @doc """
  Full-text search over vault notes.

  Returns `{:ok, results}` where each result is:

      %{
        note: %Ema.SecondBrain.Note{},
        rank: float(),       # FTS5 rank (lower is better match; we negate for display)
        snippet: String.t()  # Highlighted snippet from content
      }

  ## Options
    - `:limit` — max results (default 20)
    - `:space` — filter to a specific space
  """
  @spec search(String.t(), keyword()) :: {:ok, list(map())} | {:error, term()}
  def search(query, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)
    space_filter = Keyword.get(opts, :space)

    # Sanitize query for FTS5 — wrap in quotes if no special operators
    fts_query = sanitize_fts_query(query)

    sql = """
    SELECT
      f.note_id,
      f.rank,
      snippet(vault_notes_fts, 4, '<b>', '</b>', '...', 32) AS snippet
    FROM vault_notes_fts f
    WHERE vault_notes_fts MATCH ?
    ORDER BY rank
    LIMIT ?
    """

    case Repo.query(sql, [fts_query, limit]) do
      {:ok, %{rows: rows, columns: columns}} ->
        note_ids =
          Enum.map(rows, fn row ->
            row |> List.first()
          end)

        notes_map =
          Note
          |> where([n], n.id in ^note_ids)
          |> then(fn q ->
            if space_filter, do: where(q, [n], n.space == ^space_filter), else: q
          end)
          |> Repo.all()
          |> Map.new(&{&1.id, &1})

        col_idx = columns |> Enum.with_index() |> Map.new(fn {c, i} -> {c, i} end)

        results =
          rows
          |> Enum.map(fn row ->
            note_id = Enum.at(row, col_idx["note_id"])
            rank = Enum.at(row, col_idx["rank"])
            snippet = Enum.at(row, col_idx["snippet"])

            case Map.get(notes_map, note_id) do
              nil -> nil
              note -> %{note: note, rank: rank || 0.0, snippet: snippet || ""}
            end
          end)
          |> Enum.reject(&is_nil/1)

        {:ok, results}

      {:error, reason} ->
        Logger.warning("SecondBrain.Indexer.search failed: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  Rebuilds the entire FTS index from all vault notes.
  Reads file content from disk for each note.
  This is idempotent and can be run at startup or triggered manually.
  """
  @spec reindex_all() :: {:ok, non_neg_integer()} | {:error, term()}
  def reindex_all do
    Logger.info("SecondBrain.Indexer: starting full reindex...")

    notes = Repo.all(Note)
    total = length(notes)

    results =
      notes
      |> Enum.with_index(1)
      |> Enum.map(fn {note, i} ->
        if rem(i, 50) == 0 do
          Logger.info("SecondBrain.Indexer: indexed #{i}/#{total} notes")
        end

        index_note(note)
      end)

    errors = Enum.count(results, &match?({:error, _}, &1))
    Logger.info("SecondBrain.Indexer: reindex complete — #{total} notes, #{errors} errors")

    {:ok, total - errors}
  end

  @doc """
  Returns the number of notes currently in the FTS index.
  """
  @spec index_size() :: non_neg_integer()
  def index_size do
    case Repo.query("SELECT COUNT(*) FROM vault_notes_fts", []) do
      {:ok, %{rows: [[count]]}} -> count || 0
      _ -> 0
    end
  end

  # ---------------------------------------------------------------------------
  # Private helpers
  # ---------------------------------------------------------------------------

  defp read_content(%Note{file_path: nil}), do: ""

  defp read_content(%Note{file_path: file_path}) do
    full_path = Ema.SecondBrain.vault_file_path(file_path)

    case File.read(full_path) do
      {:ok, content} ->
        # Strip YAML frontmatter before indexing
        strip_frontmatter(content)

      {:error, _} ->
        ""
    end
  end

  defp strip_frontmatter(content) do
    case Regex.run(~r/\A---\n.*?\n---\n(.*)/ms, content, capture: :all_but_first) do
      [body] -> body
      _ -> content
    end
  end

  # Sanitize FTS5 query to avoid syntax errors on bare words
  defp sanitize_fts_query(query) do
    query = String.trim(query)

    # If user already uses FTS5 operators, pass through
    if Regex.match?(~r/[():"*\-]|AND|OR|NOT/, query) do
      query
    else
      # Wrap individual words in prefix matches for friendlier UX
      query
      |> String.split(~r/\s+/, trim: true)
      |> Enum.map(&"#{&1}*")
      |> Enum.join(" ")
    end
  end
end
