defmodule Ema.Skills do
  @moduledoc """
  Skill discovery, loading, and auto-injection for the Ema agent ecosystem.

  Skills are filesystem markdown files at `~/.local/share/ema/vault/wiki/Skills/<slug>/SKILL.md`.
  This module parses them on demand (no GenServer cache yet — directory is small) and
  exposes:

    * `list_all/0` — every parsed skill
    * `find_relevant/2` — keyword + trigger match for a query
    * `auto_load_for_prompt/2` — relevant skills concatenated for prompt injection
    * `validate_all/0` — contract check for `ema skills validate`

  ## Auto-load contract

  When `Ema.Claude.ContextManager` builds a prompt, it calls
  `auto_load_for_prompt(user_message)` and injects the result as a
  `## Loaded Skills` section. Total injected content is capped at ~2000 tokens
  (≈ 8000 chars) to stay within the per-section budget.
  """

  alias Ema.Skills.Skill

  @skills_dir Path.expand("~/.local/share/ema/vault/wiki/Skills")
  @max_chars 8_000

  @doc "Return the canonical skills directory path."
  def skills_dir, do: @skills_dir

  @doc """
  Parse every SKILL.md under the skills directory. Returns a list of
  `%Skill{}` structs (validated). Invalid skills are included with
  `valid?: false` so callers can surface errors.
  """
  def list_all do
    @skills_dir
    |> Path.join("*/SKILL.md")
    |> Path.wildcard()
    |> Enum.map(&parse_skill/1)
    |> Enum.reject(&is_nil/1)
    |> Enum.map(&Skill.validate/1)
    |> Enum.sort_by(& &1.name)
  end

  @doc """
  Look up a single skill by name (the frontmatter `name` field) or by
  directory slug. Returns `{:ok, skill}` or `{:error, :not_found}`.
  """
  def get(name) when is_binary(name) do
    case Enum.find(list_all(), &(&1.name == name or &1.slug == name)) do
      nil -> {:error, :not_found}
      skill -> {:ok, skill}
    end
  end

  @doc """
  Score skills against a query string. Matches against name, description,
  and triggers. Returns the top `limit` results sorted by descending score.
  Skills with score 0 are dropped.
  """
  def find_relevant(query, limit \\ 5) when is_binary(query) do
    terms = tokenize(query)

    list_all()
    |> Enum.filter(& &1.valid?)
    |> Enum.map(fn skill -> {skill, score(skill, terms)} end)
    |> Enum.reject(fn {_skill, score} -> score == 0 end)
    |> Enum.sort_by(fn {_skill, score} -> -score end)
    |> Enum.take(limit)
    |> Enum.map(fn {skill, _score} -> skill end)
  end

  @doc """
  Build a markdown block of relevant skills for prompt injection.
  Returns an empty string when no skills match. Caps total length at
  `@max_chars` to honor the per-section token budget.
  """
  def auto_load_for_prompt(prompt, opts \\ []) when is_binary(prompt) do
    limit = Keyword.get(opts, :limit, 3)
    max_chars = Keyword.get(opts, :max_chars, @max_chars)

    case find_relevant(prompt, limit) do
      [] ->
        ""

      skills ->
        body =
          skills
          |> Enum.map(&render_skill_for_prompt/1)
          |> Enum.join("\n\n---\n\n")
          |> truncate(max_chars)

        "## Loaded Skills\n\n" <> body
    end
  end

  @doc """
  Validate every skill on disk. Returns a list of
  `{:ok, skill}` and `{:error, skill, reasons}` tuples for CLI reporting.
  """
  def validate_all do
    Enum.map(list_all(), fn skill ->
      if skill.valid?, do: {:ok, skill}, else: {:error, skill, skill.errors}
    end)
  end

  # ── parsing ───────────────────────────────────────────────────────────────

  defp parse_skill(path) do
    case File.read(path) do
      {:ok, raw} ->
        case parse_frontmatter(raw) do
          {:ok, frontmatter, body} ->
            %Skill{
              name: Map.get(frontmatter, "name", ""),
              description: Map.get(frontmatter, "description", ""),
              triggers: Map.get(frontmatter, "triggers", []),
              path: path,
              slug: path |> Path.dirname() |> Path.basename(),
              content: body
            }

          :error ->
            %Skill{
              name: path |> Path.dirname() |> Path.basename(),
              description: "(failed to parse frontmatter)",
              triggers: [],
              path: path,
              slug: path |> Path.dirname() |> Path.basename(),
              content: raw,
              valid?: false,
              errors: ["malformed frontmatter"]
            }
        end

      {:error, _reason} ->
        nil
    end
  end

  # Minimal YAML frontmatter parser. Supports:
  #   key: value
  #   key:
  #     - item
  #     - item
  # Anything more exotic is rejected.
  defp parse_frontmatter("---\n" <> rest) do
    case String.split(rest, "\n---\n", parts: 2) do
      [yaml, body] -> {:ok, parse_yaml_simple(yaml), body}
      _ -> :error
    end
  end

  defp parse_frontmatter(_), do: :error

  defp parse_yaml_simple(yaml) do
    yaml
    |> String.split("\n", trim: false)
    |> Enum.reduce({%{}, nil}, &parse_yaml_line/2)
    |> elem(0)
  end

  defp parse_yaml_line(line, {acc, current_list_key}) do
    cond do
      # blank or comment
      String.trim(line) == "" or String.starts_with?(String.trim_leading(line), "#") ->
        {acc, current_list_key}

      # list item under a current key
      String.match?(line, ~r/^\s+-\s+/) and not is_nil(current_list_key) ->
        item =
          line
          |> String.replace(~r/^\s+-\s+/, "")
          |> String.trim()
          |> strip_quotes()

        existing = Map.get(acc, current_list_key, [])
        {Map.put(acc, current_list_key, existing ++ [item]), current_list_key}

      # `key:` opening a list
      String.match?(line, ~r/^[a-zA-Z_][a-zA-Z0-9_-]*:\s*$/) ->
        key = line |> String.trim() |> String.trim_trailing(":")
        {Map.put(acc, key, []), key}

      # `key: value`
      String.match?(line, ~r/^[a-zA-Z_][a-zA-Z0-9_-]*:\s+.+/) ->
        [key, value] = String.split(line, ":", parts: 2)
        {Map.put(acc, String.trim(key), value |> String.trim() |> strip_quotes()), nil}

      true ->
        {acc, current_list_key}
    end
  end

  defp strip_quotes(value) do
    value
    |> String.trim()
    |> String.trim_leading("\"")
    |> String.trim_trailing("\"")
    |> String.trim_leading("'")
    |> String.trim_trailing("'")
  end

  # ── scoring ───────────────────────────────────────────────────────────────

  defp tokenize(text) do
    text
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s_-]/u, " ")
    |> String.split(~r/\s+/, trim: true)
    |> Enum.reject(&(String.length(&1) < 3))
    |> MapSet.new()
  end

  defp score(%Skill{} = skill, query_terms) do
    name_terms = tokenize(skill.name)
    desc_terms = tokenize(skill.description)
    trigger_terms = skill.triggers |> Enum.flat_map(&String.split/1) |> tokenize_list()

    name_hits = MapSet.intersection(query_terms, name_terms) |> MapSet.size()
    desc_hits = MapSet.intersection(query_terms, desc_terms) |> MapSet.size()
    trigger_hits = MapSet.intersection(query_terms, trigger_terms) |> MapSet.size()

    # Triggers are explicit "load me when..." signals — weight them highest.
    trigger_hits * 5 + name_hits * 3 + desc_hits * 1
  end

  defp tokenize_list(words) do
    words
    |> Enum.map(&String.downcase/1)
    |> Enum.reject(&(String.length(&1) < 3))
    |> MapSet.new()
  end

  # ── rendering ─────────────────────────────────────────────────────────────

  defp render_skill_for_prompt(%Skill{} = skill) do
    """
    ### Skill: #{skill.name}
    #{skill.description}

    #{skill.content}
    """
    |> String.trim()
  end

  defp truncate(text, max) when byte_size(text) <= max, do: text

  defp truncate(text, max) do
    String.slice(text, 0, max) <> "\n\n…(skill content truncated to fit budget)"
  end
end
