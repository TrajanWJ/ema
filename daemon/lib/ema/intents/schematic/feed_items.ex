defmodule Ema.Intents.Schematic.FeedItems do
  @moduledoc """
  Shared context for schematic feed items: clarifications and hard answers.

  Both feed types share the same `schematic_feed_items` table and the same
  request/answer/chat/delete lifecycle. The only difference is the
  `feed_type` column ("clarification" | "hard_answer") and the prompt used
  when asking Claude to generate new items.

  This module is parameterized by `feed_type` so that the
  `Clarifications` and `HardAnswers` thin wrappers can delegate everything
  here without duplication.
  """

  import Ecto.Query

  alias Ema.Repo
  alias Ema.Intents
  alias Ema.Intents.Schematic.{FeedItem, Target}
  alias Ema.Claude.Runner

  require Logger

  @feed_types ~w(clarification hard_answer)

  # ── Reads ────────────────────────────────────────────────────────

  @doc """
  List feed items of `feed_type`. Defaults to status="open".

  Options:
    * `:scope_path` — exact match on scope_path
    * `:status` — defaults to "open"; pass `:any` to skip the filter
  """
  def list(feed_type, opts \\ []) when feed_type in @feed_types do
    status = Keyword.get(opts, :status, "open")
    scope_path = Keyword.get(opts, :scope_path)

    FeedItem
    |> where([f], f.feed_type == ^feed_type)
    |> maybe_status_filter(status)
    |> maybe_scope_filter(scope_path)
    |> order_by([f], desc: f.inserted_at)
    |> Repo.all()
  end

  def get(id), do: Repo.get(FeedItem, id)
  def get!(id), do: Repo.get!(FeedItem, id)

  def count_open(feed_type, scope_path \\ nil) when feed_type in @feed_types do
    FeedItem
    |> where([f], f.feed_type == ^feed_type and f.status == "open")
    |> maybe_scope_filter(scope_path)
    |> select([f], count(f.id))
    |> Repo.one()
  end

  # ── Writes ───────────────────────────────────────────────────────

  def create(attrs) do
    attrs = Map.put_new(attrs, :status, "open")

    %FeedItem{}
    |> FeedItem.changeset(attrs)
    |> Repo.insert()
  end

  def delete(id) do
    case get(id) do
      nil -> {:error, :not_found}
      item -> Repo.delete(item)
    end
  end

  # ── Request (ask Claude to generate items) ───────────────────────

  @doc """
  Ask Claude to generate new feed items for `scope_path`.

  Resolves the scope, walks the intents in scope, builds a prompt
  (clarification vs. hard_answer differs in framing), parses the JSON
  response, and inserts the items as FeedItems.

  Returns `{:ok, [items_created]}` or `{:error, reason}`.
  """
  def request(feed_type, scope_path, _opts \\ [])
      when feed_type in @feed_types and is_binary(scope_path) do
    with {:ok, target} <- Target.resolve(scope_path),
         intents = Target.intents_in_scope(target),
         {:ok, prompt} <- {:ok, build_prompt(feed_type, scope_path, target, intents)},
         {:ok, raw} <- call_claude(prompt),
         {:ok, items} <- parse_items(raw) do
      created =
        items
        |> Enum.map(fn item ->
          attrs = %{
            feed_type: feed_type,
            scope_path: scope_path,
            target_intent_id: resolve_target_intent(item, intents),
            title: Map.get(item, "title", "(untitled)"),
            context: Map.get(item, "context"),
            options: Map.get(item, "options", %{}),
            status: "open"
          }

          case create(attrs) do
            {:ok, fi} -> fi
            {:error, reason} ->
              Logger.warning("[FeedItems] insert failed: #{inspect(reason)}")
              nil
          end
        end)
        |> Enum.reject(&is_nil/1)

      {:ok, created}
    else
      {:error, :claude_not_available} ->
        {:error, :claude_not_available}

      {:error, %{code: :not_found}} ->
        {:error, :claude_not_available}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp call_claude(prompt) do
    if Runner.available?() do
      case Runner.run(prompt, stage: :feed_items, skip_preflight: true) do
        {:ok, parsed} -> {:ok, parsed}
        {:error, reason} -> {:error, reason}
      end
    else
      {:error, :claude_not_available}
    end
  end

  # Claude --output-format json wraps the model's text in a "result" key.
  # Try several extraction paths so we're robust to wrapping changes.
  defp parse_items(%{"result" => result}) when is_binary(result), do: extract_items(result)
  defp parse_items(%{"items" => _} = map), do: {:ok, normalize_items(map)}
  defp parse_items(%{"raw" => raw}) when is_binary(raw), do: extract_items(raw)
  defp parse_items(other) when is_binary(other), do: extract_items(other)
  defp parse_items(_), do: {:ok, []}

  defp extract_items(text) when is_binary(text) do
    case find_json_object(text) do
      nil ->
        {:ok, []}

      json ->
        case Jason.decode(json) do
          {:ok, %{"items" => _} = map} -> {:ok, normalize_items(map)}
          {:ok, _} -> {:ok, []}
          {:error, _} -> {:ok, []}
        end
    end
  end

  defp normalize_items(%{"items" => items}) when is_list(items), do: items
  defp normalize_items(_), do: []

  # Find the first balanced {...} block in `text`. Claude often wraps the
  # JSON in prose or ```json fences, so we walk the codepoints tracking
  # brace depth and slice between the first '{' and its matching '}'.
  defp find_json_object(text) when is_binary(text) do
    case :binary.match(text, "{") do
      :nomatch ->
        nil

      {start, _len} ->
        rest = binary_part(text, start, byte_size(text) - start)
        case scan_close(rest, 0, 0) do
          nil -> nil
          end_pos -> binary_part(rest, 0, end_pos + 1)
        end
    end
  end

  # Returns the byte offset (within `bin`) of the matching closing brace,
  # or nil if unbalanced. `bin` must start with '{'.
  defp scan_close(<<>>, _pos, _depth), do: nil

  defp scan_close(<<"{", rest::binary>>, pos, depth),
    do: scan_close(rest, pos + 1, depth + 1)

  defp scan_close(<<"}", _rest::binary>>, pos, 1), do: pos

  defp scan_close(<<"}", rest::binary>>, pos, depth) when depth > 1,
    do: scan_close(rest, pos + 1, depth - 1)

  defp scan_close(<<_::utf8, rest::binary>> = bin, pos, depth) do
    skip = byte_size(bin) - byte_size(rest)
    scan_close(rest, pos + skip, depth)
  end

  defp resolve_target_intent(%{"intent_slug" => slug}, intents) when is_binary(slug) do
    case Enum.find(intents, &(&1.slug == slug)) do
      nil -> nil
      intent -> intent.id
    end
  end

  defp resolve_target_intent(_, _), do: nil

  # ── Answer ───────────────────────────────────────────────────────

  @doc """
  Apply a user answer to a feed item.

  `params` is a map with one of:
    * `:select` — list of option keys, e.g. ["A1", "B2"]
    * `:text`   — freeform string

  Optional:
    * `:actor_id` — the actor recording the answer

  Records the resolution on the FeedItem and emits an IntentEvent if a
  target intent is set. Does NOT mutate intents — that happens via the
  next NL update from the user.
  """
  def answer(id, params) when is_map(params) do
    case get(id) do
      nil ->
        {:error, :not_found}

      %FeedItem{} = item ->
        select = Map.get(params, :select) || []
        text = Map.get(params, :text)

        resolution = build_resolution(item, select, text)

        attrs = %{
          status: "answered",
          selected: select,
          user_response: text,
          resolution: resolution,
          resolved_at: DateTime.utc_now() |> DateTime.truncate(:second)
        }

        case item |> FeedItem.changeset(attrs) |> Repo.update() do
          {:ok, updated} ->
            maybe_emit_resolution_event(updated, resolution)
            {:ok, updated}

          {:error, _} = err ->
            err
        end
    end
  end

  defp build_resolution(_item, [], text) when is_binary(text) and text != "", do: text

  defp build_resolution(%FeedItem{options: options}, select, _text) when is_list(select) and select != [] do
    parts =
      Enum.map(select, fn key ->
        describe_selection(options, key)
      end)

    "User chose " <> Enum.join(parts, " and ")
  end

  defp build_resolution(_item, _select, _text), do: nil

  # Selection key form: "<option><variant>" e.g. "A1" or "C3".
  # First char is the option group, remainder is the variant key.
  defp describe_selection(options, key) when is_binary(key) and is_map(options) do
    {group_key, variant_key} = split_selection_key(key)

    case Map.get(options, group_key) || Map.get(options, String.downcase(group_key)) do
      nil ->
        key

      group when is_map(group) ->
        label = Map.get(group, "label") || Map.get(group, :label) || group_key
        variants = Map.get(group, "variants") || Map.get(group, :variants) || %{}
        variant = Map.get(variants, variant_key) || Map.get(variants, to_string(variant_key))

        case variant do
          nil -> "#{key} (#{label})"
          v when is_binary(v) -> "#{key} (#{label} — #{v})"
          v -> "#{key} (#{label} — #{inspect(v)})"
        end

      _ ->
        key
    end
  end

  defp describe_selection(_, key), do: to_string(key)

  defp split_selection_key(key) do
    case String.graphemes(key) do
      [g | rest] -> {g, Enum.join(rest)}
      [] -> {key, ""}
    end
  end

  defp maybe_emit_resolution_event(%FeedItem{target_intent_id: nil}, _resolution), do: :ok

  defp maybe_emit_resolution_event(%FeedItem{} = item, resolution) do
    event_type =
      case item.feed_type do
        "clarification" -> "clarification_resolved"
        "hard_answer" -> "hard_answer_resolved"
        other -> "#{other}_resolved"
      end

    payload = %{
      feed_item_id: item.id,
      feed_type: item.feed_type,
      title: item.title,
      selected: item.selected,
      resolution: resolution
    }

    Intents.emit_event(item.target_intent_id, event_type, payload)
    :ok
  end

  # ── Escalate to chat ─────────────────────────────────────────────

  def escalate_to_chat(id, session_id \\ nil) do
    case get(id) do
      nil ->
        {:error, :not_found}

      %FeedItem{} = item ->
        item
        |> FeedItem.changeset(%{status: "chat", chat_session_id: session_id})
        |> Repo.update()
    end
  end

  # ── Prompt builders ──────────────────────────────────────────────

  defp build_prompt("clarification", scope_path, target, intents) do
    """
    You are EMA's clarification engine. Your job is to surface assumption
    blockers — ambiguities, missing definitions, and unresolved questions
    in the current intent definitions for scope `#{scope_path}` that the
    user must answer before forward progress is safe.

    #{format_target(target)}

    Current intents in scope:
    #{format_intents(intents)}

    Identify up to 5 high-leverage clarifications. For each, propose four
    distinct option groups (A, B, C, D) representing different stances or
    interpretations the user could take. Within each group, propose three
    variants (1, 2, 3) ranging from minimal to ambitious.

    #{json_contract()}

    Return ONLY the JSON object, no prose. Each item should reference an
    intent slug in the optional `intent_slug` field if it pertains to a
    specific intent.
    """
  end

  defp build_prompt("hard_answer", scope_path, target, intents) do
    """
    You are EMA's hard-answers engine. Surface DEFERRED hard questions
    about scope, priorities, tradeoffs, or strategy for `#{scope_path}`
    that the user has been avoiding but that block real progress.

    #{format_target(target)}

    Current intents in scope:
    #{format_intents(intents)}

    Identify up to 5 hard questions. For each, propose four option groups
    (A, B, C, D) representing genuinely different strategic stances, with
    three variants (1, 2, 3) per group ranging from minimal to ambitious.

    #{json_contract()}

    Return ONLY the JSON object, no prose. Each item may reference an
    intent slug in the optional `intent_slug` field.
    """
  end

  defp json_contract do
    """
    Respond with this exact JSON shape:

    {
      "items": [
        {
          "title": "Short question or blocker",
          "context": "1-3 sentences explaining why this matters now",
          "intent_slug": "optional-slug-of-related-intent",
          "options": {
            "A": {
              "label": "Stance label",
              "variants": {
                "1": "Minimal variant description",
                "2": "Moderate variant description",
                "3": "Ambitious variant description"
              }
            },
            "B": { "label": "...", "variants": { "1": "...", "2": "...", "3": "..." } },
            "C": { "label": "...", "variants": { "1": "...", "2": "...", "3": "..." } },
            "D": { "label": "...", "variants": { "1": "...", "2": "...", "3": "..." } }
          }
        }
      ]
    }
    """
  end

  defp format_target(%{space: space, project: project, subproject: sub, intent: intent}) do
    parts = [
      space && "  space: #{Map.get(space, :name) || Map.get(space, :id)}",
      project && "  project: #{project.slug}",
      sub && "  subproject: #{sub.slug}",
      intent && "  intent: #{intent.slug} — #{intent.title}"
    ]

    "Resolved scope:\n" <> (parts |> Enum.reject(&is_nil/1) |> Enum.join("\n"))
  end

  defp format_intents([]), do: "  (no intents in scope)"

  defp format_intents(intents) do
    intents
    |> Enum.take(50)
    |> Enum.map_join("\n", fn i ->
      desc = if i.description && i.description != "", do: " — #{String.slice(i.description, 0, 120)}", else: ""
      "  - [#{i.status}] #{i.slug}: #{i.title}#{desc}"
    end)
  end

  # ── Query helpers ────────────────────────────────────────────────

  defp maybe_status_filter(query, :any), do: query
  defp maybe_status_filter(query, nil), do: query
  defp maybe_status_filter(query, status), do: where(query, [f], f.status == ^status)

  defp maybe_scope_filter(query, nil), do: query
  defp maybe_scope_filter(query, scope), do: where(query, [f], f.scope_path == ^scope)
end
