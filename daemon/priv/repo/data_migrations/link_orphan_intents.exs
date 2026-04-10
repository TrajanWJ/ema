# One-shot data migration: heuristic linkage of orphan intents into the
# vision -> goal -> project -> feature -> task hierarchy.
#
# Run with:
#   mix run priv/repo/data_migrations/link_orphan_intents.exs
#
# Strategy:
# 1. Vision intents (level 0) become roots — they keep parent_id = nil.
# 2. For every other intent without a parent, search levels above it
#    (level - 1, then level - 2, ...) for a candidate parent and pick
#    the best heuristic match.
# 3. Heuristics, in priority order:
#    a) project_id match (same project)
#    b) shared tag overlap
#    c) substring containment of words from candidate's title in this
#       intent's title or description (>=1 distinct content word match)
#    d) fall back to the highest-level intent in the same project
# 4. Never create a cycle. Skip self-reference.
#
# This script is idempotent: it never overwrites a non-nil parent.

import Ecto.Query
alias Ema.Repo
alias Ema.Intents
alias Ema.Intents.Intent

stopwords =
  ~w(the a an and or but of for to in on at by with from as is are was were be been
     this that these those it its his her their them they we you i me my our your
     about into over under more less than then so if not no yes do does did has have
     had can could should would will may might shall must one two new use using
     ema build make get fix add update create remove change improve enable disable)
  |> MapSet.new()

tokenize = fn
  nil ->
    MapSet.new()

  text when is_binary(text) ->
    text
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s]/, " ")
    |> String.split(~r/\s+/, trim: true)
    |> Enum.reject(&MapSet.member?(stopwords, &1))
    |> Enum.reject(&(String.length(&1) < 3))
    |> MapSet.new()
end

intent_words = fn intent ->
  MapSet.union(tokenize.(intent.title), tokenize.(intent.description))
end

decode_tags = fn intent ->
  case Intent.decode_tags(intent) do
    list when is_list(list) -> MapSet.new(Enum.map(list, &to_string/1))
    _ -> MapSet.new()
  end
end

all = Repo.all(from i in Intent, order_by: [asc: i.level])
IO.puts("[link_orphan_intents] loaded #{length(all)} intents")

orphans =
  Enum.filter(all, fn i ->
    is_nil(i.parent_id) and i.level > 0
  end)

IO.puts("[link_orphan_intents] #{length(orphans)} candidates need a parent")

# Pre-index by level for fast lookups
by_level = Enum.group_by(all, & &1.level)

ancestors_of = fn intent_id ->
  intent_id
  |> Intents.ancestors()
  |> Enum.map(& &1.id)
  |> MapSet.new()
end

score_candidate = fn candidate, child, child_words, child_tags ->
  cond do
    candidate.id == child.id ->
      -1

    true ->
      project_score =
        if candidate.project_id && candidate.project_id == child.project_id, do: 50, else: 0

      tag_overlap =
        candidate
        |> decode_tags.()
        |> MapSet.intersection(child_tags)
        |> MapSet.size()

      tag_score = tag_overlap * 10

      cand_words = intent_words.(candidate)

      word_overlap =
        child_words
        |> MapSet.intersection(cand_words)
        |> MapSet.size()

      word_score = word_overlap * 5

      project_score + tag_score + word_score
  end
end

linked = :counters.new(1, [])
skipped = :counters.new(1, [])

Enum.each(orphans, fn orphan ->
  child_words = intent_words.(orphan)
  child_tags = decode_tags.(orphan)

  # Walk up levels looking for the best candidate parent.
  candidate_levels = (orphan.level - 1)..0//-1

  best =
    candidate_levels
    |> Enum.flat_map(fn lvl -> Map.get(by_level, lvl, []) end)
    |> Enum.map(fn cand -> {cand, score_candidate.(cand, orphan, child_words, child_tags)} end)
    |> Enum.filter(fn {_, score} -> score > 0 end)
    |> Enum.sort_by(fn {_, score} -> -score end)
    |> List.first()

  fallback =
    if best == nil do
      # Fallback: any vision/goal in the same project
      candidate_levels
      |> Enum.flat_map(fn lvl -> Map.get(by_level, lvl, []) end)
      |> Enum.find(fn cand -> cand.project_id == orphan.project_id and cand.id != orphan.id end)
    else
      nil
    end

  parent =
    case {best, fallback} do
      {{cand, _score}, _} -> cand
      {nil, cand} when not is_nil(cand) -> cand
      _ -> nil
    end

  cond do
    is_nil(parent) ->
      :counters.add(skipped, 1, 1)

    MapSet.member?(ancestors_of.(parent.id), orphan.id) ->
      # would cycle
      :counters.add(skipped, 1, 1)

    true ->
      case Intents.set_parent(orphan.id, parent.id) do
        {:ok, _} ->
          :counters.add(linked, 1, 1)
          IO.puts("  linked #{orphan.id} (#{orphan.title}) -> #{parent.id} (#{parent.title})")

        {:error, reason} ->
          :counters.add(skipped, 1, 1)
          IO.puts("  skipped #{orphan.id}: #{inspect(reason)}")
      end
  end
end)

IO.puts(
  "[link_orphan_intents] linked=#{:counters.get(linked, 1)} skipped=#{:counters.get(skipped, 1)}"
)
