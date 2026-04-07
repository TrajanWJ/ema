defmodule Ema.SecondBrain.VaultLint do
  @moduledoc "Lint checks for vault notes — stubs, orphans, thin content, duplicate tags."

  import Ecto.Query
  alias Ema.Repo
  alias Ema.SecondBrain
  alias Ema.SecondBrain.Link

  @default_min_words 20
  @default_max_age_days 90

  @doc """
  Run all lint checks and return a list of report maps.

  Options:
    - `:min_words` — minimum word count threshold (default #{@default_min_words})
    - `:max_age_days` — flag notes older than this without updates (default #{@default_max_age_days})
    - `:min_shared_tags` — minimum shared tags to flag as near-duplicate
    - `:checks` — list of specific checks to run (default: all)
  """
  def run_all(opts \\ []) do
    checks = Keyword.get(opts, :checks, [:thin, :orphans, :stale])

    notes = SecondBrain.list_notes()

    reports =
      []
      |> maybe_run(:thin, checks, fn -> check_thin(notes, opts) end)
      |> maybe_run(:orphans, checks, fn -> check_orphans(notes) end)
      |> maybe_run(:stale, checks, fn -> check_stale(notes, opts) end)

    reports
  end

  defp maybe_run(acc, check, enabled_checks, fun) do
    if check in enabled_checks do
      acc ++ [fun.()]
    else
      acc
    end
  end

  defp check_thin(notes, opts) do
    min_words = Keyword.get(opts, :min_words, @default_min_words)

    thin =
      notes
      |> Enum.filter(fn note ->
        content = note.content || ""
        word_count = content |> String.split(~r/\s+/, trim: true) |> length()
        word_count < min_words
      end)
      |> Enum.map(fn note -> %{path: note.file_path, words: word_count(note)} end)

    %{check: :thin, count: length(thin), items: thin}
  end

  defp check_orphans(notes) do
    # Get all note IDs that participate in any link
    linked_source_ids = Link |> select([l], l.source_note_id) |> Repo.all()
    linked_target_ids = Link |> select([l], l.target_note_id) |> Repo.all()
    linked_ids = MapSet.new(linked_source_ids ++ linked_target_ids)

    orphans =
      notes
      |> Enum.reject(fn note -> MapSet.member?(linked_ids, note.id) end)
      |> Enum.map(fn note -> %{path: note.file_path} end)

    %{check: :orphans, count: length(orphans), items: orphans}
  end

  defp check_stale(notes, opts) do
    max_age = Keyword.get(opts, :max_age_days, @default_max_age_days)
    cutoff = Date.utc_today() |> Date.add(-max_age)

    stale =
      notes
      |> Enum.filter(fn note ->
        case note.updated_at do
          nil -> true
          dt -> Date.compare(DateTime.to_date(dt), cutoff) == :lt
        end
      end)
      |> Enum.map(fn note -> %{path: note.file_path, updated_at: note.updated_at} end)

    %{check: :stale, count: length(stale), items: stale}
  end

  defp word_count(note) do
    (note.content || "") |> String.split(~r/\s+/, trim: true) |> length()
  end
end
