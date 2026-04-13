defmodule Ema.Intents.Schematic.UpdateParser do
  @moduledoc """
  Calls Claude to convert a freeform NL update into a structured plan of
  intent mutations, contradictions, clarifications, and aspirations.

  The parser is intentionally defensive: anything that looks like
  ```json``` fences is stripped, malformed JSON returns
  `{:error, {:parse_failed, raw}}`, and missing top-level keys default
  to empty lists so callers can pattern-match safely.
  """

  alias Ema.Claude.Runner
  alias Ema.Intents.Intent

  @top_keys ~w(mutations contradictions clarifications_needed aspirations)

  @doc """
  Build the prompt, call Claude, and parse the JSON plan.

  `context` is a map with keys:

    * `:scope_path` — dotted path string for the target scope
    * `:existing_intents` — list of `%Intent{}` already in scope
    * `:open_contradictions` — list of contradiction maps/structs
    * `:recent_updates` — list of recent UpdateLog rows

  Returns `{:ok, plan_map}` or `{:error, reason}`.
  """
  @spec parse(String.t(), map()) :: {:ok, map()} | {:error, term()}
  def parse(text, context) when is_binary(text) and is_map(context) do
    prompt = build_prompt(text, context)

    try do
      case Runner.run(prompt, []) do
        {:ok, %{"result" => raw}} when is_binary(raw) ->
          decode(raw)

        {:ok, %{result: raw}} when is_binary(raw) ->
          decode(raw)

        {:ok, other} ->
          {:error, {:unexpected_runner_response, other}}

        {:error, reason} ->
          {:error, reason}
      end
    rescue
      e -> {:error, {:runner_exception, Exception.message(e)}}
    catch
      kind, reason -> {:error, {:runner_exception, {kind, reason}}}
    end
  end

  @doc "Empty plan with all keys set to empty lists. Safe default."
  @spec default_plan() :: map()
  def default_plan do
    %{
      "mutations" => [],
      "contradictions" => [],
      "clarifications_needed" => [],
      "aspirations" => []
    }
  end

  # ── Prompt assembly ──────────────────────────────────────────────

  defp build_prompt(text, context) do
    scope = Map.get(context, :scope_path, "<unknown>")
    existing = Map.get(context, :existing_intents, [])
    contradictions = Map.get(context, :open_contradictions, [])
    recent = Map.get(context, :recent_updates, [])

    """
    You are the Intentions Schematic Engine for EMA, a personal life-OS.
    Your job is to translate freeform natural-language updates into
    structured mutations on an intent tree.

    ## Target scope
    `#{scope}`

    ## Existing intents in this scope
    #{render_intents(existing)}

    ## Open contradictions
    #{render_contradictions(contradictions)}

    ## Recent updates
    #{render_recent(recent)}

    ## User update
    \"\"\"
    #{text}
    \"\"\"

    ## Your task
    Return ONLY a single JSON object (no prose, no fences) matching this contract:

    {
      "mutations": [
        {
          "action": "create" | "update" | "reparent" | "delete",
          "intent": {
            "slug": "kebab-case-slug",
            "title": "Human title",
            "parent_slug": "optional-parent-slug-or-null",
            "kind": "vision" | "goal" | "project" | "feature" | "task",
            "level": 0,
            "summary": "one-sentence summary",
            "rationale": "why this mutation"
          }
        }
      ],
      "contradictions": [
        {
          "intent_slugs": ["slug-a", "slug-b"],
          "description": "what conflicts and why",
          "severity": "low" | "medium" | "high" | "critical"
        }
      ],
      "clarifications_needed": [
        {
          "title": "short question",
          "context": "why we need to ask",
          "options": {
            "A": {
              "label": "option label",
              "variants": {"1": "variant 1", "2": "variant 2", "3": "variant 3"}
            },
            "B": {"label": "...", "variants": {"1": "...", "2": "...", "3": "..."}},
            "C": {"label": "...", "variants": {"1": "...", "2": "...", "3": "..."}},
            "D": {"label": "...", "variants": {"1": "...", "2": "...", "3": "..."}}
          }
        }
      ],
      "aspirations": [
        {
          "title": "...",
          "description": "...",
          "horizon": "short" | "medium" | "long" | "ideal"
        }
      ]
    }

    Rules:
    - If nothing applies for a key, return an empty array.
    - Prefer `update` over `create` when an existing intent matches.
    - Always include all four top-level keys.
    - Output strictly valid JSON. No markdown. No commentary.
    """
  end

  defp render_intents([]), do: "(none)"

  defp render_intents(intents) do
    intents
    |> Enum.map(fn
      %Intent{} = i ->
        parent = i.parent_id || "—"
        "- #{i.slug} :: #{i.title} (kind=#{i.kind}, level=#{i.level}, parent=#{parent})"

      other ->
        "- #{inspect(other)}"
    end)
    |> Enum.join("\n")
  end

  defp render_contradictions([]), do: "(none)"

  defp render_contradictions(list) do
    list
    |> Enum.map(fn c ->
      desc = Map.get(c, :description) || Map.get(c, "description") || "(no description)"
      sev = Map.get(c, :severity) || Map.get(c, "severity") || "medium"
      "- [#{sev}] #{desc}"
    end)
    |> Enum.join("\n")
  end

  defp render_recent([]), do: "(none)"

  defp render_recent(list) do
    list
    |> Enum.map(fn log ->
      txt = Map.get(log, :input_text) || Map.get(log, "input_text") || ""
      applied = Map.get(log, :applied) || Map.get(log, "applied")
      "- (applied=#{applied}) #{String.slice(txt, 0, 120)}"
    end)
    |> Enum.join("\n")
  end

  # ── JSON decoding ────────────────────────────────────────────────

  defp decode(raw) when is_binary(raw) do
    raw
    |> strip_fences()
    |> Jason.decode()
    |> case do
      {:ok, map} when is_map(map) ->
        {:ok, normalize(map)}

      {:ok, _other} ->
        {:error, {:parse_failed, raw}}

      {:error, _} ->
        {:error, {:parse_failed, raw}}
    end
  end

  defp strip_fences(text) do
    text = String.trim(text)

    cond do
      String.starts_with?(text, "```json") ->
        text
        |> String.replace_prefix("```json", "")
        |> String.trim()
        |> String.replace_suffix("```", "")
        |> String.trim()

      String.starts_with?(text, "```") ->
        text
        |> String.replace_prefix("```", "")
        |> String.trim()
        |> String.replace_suffix("```", "")
        |> String.trim()

      true ->
        text
    end
  end

  defp normalize(map) do
    Enum.reduce(@top_keys, map, fn key, acc ->
      Map.put_new(acc, key, [])
    end)
  end
end
