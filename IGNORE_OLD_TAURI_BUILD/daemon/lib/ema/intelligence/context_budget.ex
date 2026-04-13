defmodule Ema.Intelligence.ContextBudget do
  @moduledoc """
  Allocates a token budget across context sections and selects the highest-
  relevance items that fit within each section's allocation.

  Pure functions — no GenServer, no side effects, no DB calls.

  ## Usage

      allocations = ContextBudget.allocate(budget: 6_000, sections: [:project, :tasks, :intents])
      # => %{project: 2000, tasks: 2000, intents: 2000}

      scored_items = Enum.map(tasks, &ContextBudget.score_item(&1, focus))
      selected = ContextBudget.select(scored_items, allocations.tasks)

  ## Token estimation

  Uses `div(byte_size, 4)` which is a reasonable approximation for English
  text with Claude's tokenizer. Not exact, but good enough for budgeting —
  we'd rather under-fill by 5% than blow the budget.
  """

  @default_budget 8_000

  @section_weights %{
    system_prompt: 0.25,
    project: 0.15,
    intents: 0.15,
    tasks: 0.15,
    wiki: 0.15,
    proposals: 0.10,
    conversation: 0.05,
    memory: 0.10
  }

  # Relevance score component weights. Must sum to ~1.0.
  @relevance_weights %{
    recency: 0.35,
    frequency: 0.20,
    graph_distance: 0.20,
    semantic: 0.25
  }

  # ── Budget Allocation ──────────────────────────────────────────────────────

  @doc """
  Allocate token budget across sections proportionally.

  ## Options
  - `:budget` — total token budget (default #{@default_budget})
  - `:sections` — list of section atoms to include (default: all)
  - `:overrides` — map of `%{section => tokens}` for fixed allocations;
    remaining budget is split among non-overridden sections

  Returns `%{section => token_count}`.
  """
  def allocate(opts \\ []) do
    budget = Keyword.get(opts, :budget, @default_budget)
    sections = Keyword.get(opts, :sections, Map.keys(@section_weights))
    overrides = Keyword.get(opts, :overrides, %{})

    # Subtract fixed overrides from the budget
    override_total = overrides |> Map.values() |> Enum.sum()
    remaining = max(budget - override_total, 0)

    # Filter to requested sections that aren't overridden
    dynamic_sections = Enum.reject(sections, &Map.has_key?(overrides, &1))

    active_weights =
      @section_weights
      |> Map.take(dynamic_sections)

    total_weight =
      case Map.values(active_weights) do
        [] -> 1.0
        vals -> Enum.sum(vals)
      end

    dynamic_allocations =
      Map.new(active_weights, fn {section, weight} ->
        {section, round(remaining * weight / total_weight)}
      end)

    Map.merge(dynamic_allocations, Map.take(overrides, sections))
  end

  @doc """
  Returns the default section weights for inspection/debugging.
  """
  def default_weights, do: @section_weights

  # ── Relevance Scoring ──────────────────────────────────────────────────────

  @doc """
  Score a content item for relevance to the current focus.

  `item` must have `:updated_at` (DateTime or NaiveDateTime).
  `focus` is a map with optional keys:
  - `:terms` — list of search terms to match against item content
  - `:focus_id` — id of the focal entity (for graph distance, future use)

  Returns a float 0.0..1.0.
  """
  def score_item(item, focus \\ %{}) do
    components = score_components(item, focus)
    weighted_sum(components, Map.get(focus, :weights, @relevance_weights))
  end

  @doc """
  Returns the individual relevance components for an item as a map.
  Useful for tracing/debugging why a particular item was selected.
  """
  def score_components(item, focus \\ %{}) do
    %{
      recency: recency_score(item),
      frequency: frequency_score(item),
      graph_distance: graph_distance_score(item, focus),
      semantic: term_match_score(item, Map.get(focus, :terms, []))
    }
  end

  @doc """
  Returns the relevance component weights, optionally overridden via focus.
  """
  def relevance_weights, do: @relevance_weights

  defp weighted_sum(components, weights) do
    Enum.reduce(components, 0.0, fn {key, value}, acc ->
      acc + value * Map.get(weights, key, 0.0)
    end)
  end

  @doc """
  Frequency score derived from how often an item has been accessed.

  Looks for `:access_count` (Memory.Entry style) or `:access_frequency`.
  Uses a log curve so that hot items rise quickly but plateau.
  Returns 0.0 when no counter is present.
  """
  def frequency_score(item) do
    count =
      Map.get(item, :access_count) ||
        Map.get(item, :access_frequency) ||
        0

    case count do
      n when is_integer(n) and n > 0 ->
        # log10(1+n) / log10(101) ≈ 1.0 at 100 hits
        :math.log10(1 + n) / :math.log10(101)

      _ ->
        0.0
    end
    |> min(1.0)
  end

  @doc """
  Graph-distance score: items closer to the focus entity in the
  SecondBrain link graph score higher.

  `focus` may carry `:graph` — a map of `%{item_id => distance}` or
  `:focus_id` for a single anchor. When neither is present this returns
  a neutral 0.5 so the component does not bias selection.

  Distance 0 → 1.0, 1 → 0.7, 2 → 0.5, 3 → 0.3, 4+ → 0.1.
  """
  def graph_distance_score(item, focus) do
    graph = Map.get(focus, :graph, %{})
    focus_id = Map.get(focus, :focus_id)
    item_id = Map.get(item, :id)

    cond do
      is_nil(item_id) ->
        0.5

      not is_nil(focus_id) and item_id == focus_id ->
        1.0

      Map.has_key?(graph, item_id) ->
        distance_to_score(Map.get(graph, item_id))

      graph == %{} and is_nil(focus_id) ->
        0.5

      true ->
        0.1
    end
  end

  defp distance_to_score(0), do: 1.0
  defp distance_to_score(1), do: 0.7
  defp distance_to_score(2), do: 0.5
  defp distance_to_score(3), do: 0.3
  defp distance_to_score(d) when is_integer(d) and d >= 4, do: 0.1
  defp distance_to_score(_), do: 0.5

  @doc """
  Score recency with a 30-day half-life decay curve.

  Returns 1.0 for "just now", ~0.5 at 30 days, ~0.25 at 90 days.
  """
  def recency_score(%{updated_at: %DateTime{} = dt}) do
    seconds = max(DateTime.diff(DateTime.utc_now(), dt, :second), 0)
    days = seconds / 86_400.0
    1.0 / (1.0 + days / 30.0)
  end

  def recency_score(%{updated_at: %NaiveDateTime{} = ndt}) do
    dt = DateTime.from_naive!(ndt, "Etc/UTC")
    recency_score(%{updated_at: dt})
  end

  def recency_score(%{inserted_at: ts}), do: recency_score(%{updated_at: ts})
  def recency_score(_), do: 0.1

  @doc """
  Score how well an item's text content matches a set of search terms.

  Checks `:title`, `:content`, `:summary`, `:body`, `:description` fields.
  Returns 0.0..1.0 (fraction of terms that appear in at least one field).
  """
  def term_match_score(_item, []), do: 0.5
  def term_match_score(_item, nil), do: 0.5

  def term_match_score(item, terms) when is_list(terms) do
    searchable = searchable_text(item)

    if searchable == "" do
      0.0
    else
      hits =
        Enum.count(terms, fn term ->
          String.contains?(searchable, String.downcase(term))
        end)

      hits / max(length(terms), 1)
    end
  end

  defp searchable_text(item) when is_map(item) do
    [:title, :content, :summary, :body, :description, :name]
    |> Enum.map(&Map.get(item, &1))
    |> Enum.reject(&is_nil/1)
    |> Enum.map_join(" ", &to_string/1)
    |> String.downcase()
  end

  defp searchable_text(_), do: ""

  # ── Token Estimation ───────────────────────────────────────────────────────

  @doc """
  Estimate token count from text. Uses byte_size/4 as a rough approximation.

  For structured data (maps/lists), serializes with `inspect/1` first.
  """
  def estimate_tokens(text) when is_binary(text), do: max(div(byte_size(text), 4), 1)
  def estimate_tokens(data) when is_map(data) or is_list(data), do: estimate_tokens(inspect(data))
  def estimate_tokens(_), do: 0

  @doc """
  Estimate the tokens a content item will consume once rendered.

  Checks `:content`, `:body`, `:summary`, `:title`, `:description` in order
  and takes the first non-nil field as the primary text.
  """
  def estimate_item_tokens(item) when is_map(item) do
    text =
      Map.get(item, :content) ||
        Map.get(item, :body) ||
        Map.get(item, :summary) ||
        Map.get(item, :title) ||
        Map.get(item, :description) ||
        inspect(item)

    estimate_tokens(to_string(text))
  end

  def estimate_item_tokens(_), do: 0

  # ── Selection ──────────────────────────────────────────────────────────────

  @doc """
  Select the highest-relevance items that fit within a token budget.

  Each item must be a map with a `:relevance` key (float, higher = better).
  Token cost is estimated from the item's text content.

  Returns the selected items in relevance-descending order.
  """
  def select(scored_items, budget_tokens, opts \\ []) when is_list(scored_items) do
    pinned = Keyword.get(opts, :pinned, [])
    pinned_ids = MapSet.new(pinned, & &1.id)

    # Pinned items are always emitted, even if they push past budget — they
    # represent the highest-priority context (current intent, active task).
    pinned_tokens = pinned |> Enum.map(&estimate_item_tokens/1) |> Enum.sum()
    remaining_after_pinned = max(budget_tokens - pinned_tokens, 0)

    {selected, _remaining} =
      scored_items
      |> Enum.reject(fn i -> MapSet.member?(pinned_ids, Map.get(i, :id)) end)
      |> Enum.sort_by(&Map.get(&1, :relevance, 0), :desc)
      |> Enum.reduce_while({[], remaining_after_pinned}, fn item, {acc, remaining} ->
        tokens = estimate_item_tokens(item)

        cond do
          tokens <= remaining ->
            {:cont, {[item | acc], remaining - tokens}}

          # Allow soft truncation of single oversized items so we don't
          # leak context when a pool has only one large doc.
          remaining > 256 ->
            truncated = truncate_item(item, remaining)
            {:halt, {[truncated | acc], 0}}

          true ->
            {:halt, {acc, remaining}}
        end
      end)

    pinned ++ Enum.reverse(selected)
  end

  defp truncate_item(item, token_budget) do
    Enum.reduce([:content, :body, :summary, :description], item, fn key, acc ->
      case Map.get(acc, key) do
        text when is_binary(text) and byte_size(text) > token_budget * 4 ->
          Map.put(acc, key, truncate_text(text, token_budget) <> "\n…[truncated]")

        _ ->
          acc
      end
    end)
    |> Map.put(:truncated, true)
  end

  @doc """
  Score and select items in one pass.

  Takes raw items, scores each against the focus, attaches `:relevance`,
  then selects within the budget.

  ## Options
  - `:focus` — focus map for scoring (default %{})
  - `:budget` — token budget for this section

  Returns `{selected_items, tokens_used}`.
  """
  def score_and_select(items, opts \\ []) do
    focus = Keyword.get(opts, :focus, %{})
    budget = Keyword.get(opts, :budget, 2_000)
    pinned = Keyword.get(opts, :pinned, [])

    scored =
      items
      |> Enum.map(fn item ->
        components = score_components(item, focus)
        relevance = weighted_sum(components, Map.get(focus, :weights, @relevance_weights))

        item
        |> Map.put(:relevance, relevance)
        |> Map.put(:relevance_components, components)
      end)

    selected = select(scored, budget, pinned: pinned)

    tokens_used =
      selected
      |> Enum.map(&estimate_item_tokens/1)
      |> Enum.sum()

    {selected, tokens_used}
  end

  # ── Convenience: Truncate Text ─────────────────────────────────────────────

  @doc """
  Truncate a text string to approximately fit within a token budget.
  """
  def truncate_text(text, token_budget) when is_binary(text) do
    char_budget = token_budget * 4

    if byte_size(text) <= char_budget do
      text
    else
      String.slice(text, 0, char_budget)
    end
  end

  def truncate_text(text, _budget), do: text
end
