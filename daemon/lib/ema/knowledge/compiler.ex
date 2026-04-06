defmodule Ema.Knowledge.Compiler do
  @moduledoc """
  Wiki Knowledge Compiler — ingests markdown pages, splits into sections,
  and extracts knowledge items using heading-based + keyword heuristics.
  """

  alias Ema.Knowledge
  alias Ema.Repo

  @decision_patterns ~w(decided decision chose chosen agreed settled selected picked)
  @intent_patterns ~w(todo plan want need should must will goal objective)
  @question_patterns ~w(? how why what when where who which)
  @evidence_patterns ~w(found discovered measured observed tested confirmed verified benchmarked)

  @doc """
  Ingest a markdown page: parse into sections, store source + sections.
  If a source with the same path exists, updates it and replaces sections.

  Options:
    - :project_key — associate with a project
    - :space_key — associate with a space
    - :source_type — defaults to "markdown"
  """
  def ingest_page(path, content, opts \\ []) do
    checksum = :crypto.hash(:sha256, content) |> Base.encode16(case: :lower)
    title = extract_title(content, path)
    sections = parse_sections(content)

    Repo.transaction(fn ->
      source = upsert_source(path, title, checksum, opts)
      Knowledge.delete_sections_for_source(source.id)

      stored_sections =
        sections
        |> Enum.with_index()
        |> Enum.map(fn {{heading, section_content}, idx} ->
          section_key = slugify(heading || "section-#{idx}")

          {:ok, section} =
            Knowledge.create_section(%{
              source_id: source.id,
              heading: heading,
              section_key: section_key,
              ordinal: idx,
              content: section_content
            })

          section
        end)

      {source, stored_sections}
    end)
  end

  @doc """
  Extract knowledge items from a source's sections using keyword heuristics.
  Deletes existing items for the source before re-extracting.
  """
  def extract_items(%{id: source_id} = _source, opts \\ []) do
    project_id = Keyword.get(opts, :project_id)
    sections = Knowledge.list_sections(source_id)

    # Clear old items for these sections
    section_ids = Enum.map(sections, & &1.id)
    clear_items_for_sections(section_ids)

    items =
      Enum.flat_map(sections, fn section ->
        extract_from_section(section, project_id)
      end)

    {:ok, items}
  end

  # --- Section Parsing ---

  defp parse_sections(content) do
    lines = String.split(content, "\n")
    {sections, current_heading, current_lines} = chunk_by_headings(lines)

    sections
    |> Enum.reverse()
    |> prepend_if({current_heading, Enum.join(Enum.reverse(current_lines), "\n")})
    |> Enum.reject(fn {_h, c} -> String.trim(c) == "" end)
  end

  defp chunk_by_headings(lines) do
    Enum.reduce(lines, {[], nil, []}, fn line, {sections, heading, acc} ->
      if heading?(line) do
        section = {heading, Enum.join(Enum.reverse(acc), "\n")}
        {[section | sections], extract_heading(line), []}
      else
        {sections, heading, [line | acc]}
      end
    end)
  end

  defp prepend_if(sections, {_heading, content}) when byte_size(content) < 2, do: sections
  defp prepend_if(sections, section), do: sections ++ [section]

  defp heading?(line), do: Regex.match?(~r/^\#{1,6}\s+/, line)

  defp extract_heading(line) do
    line |> String.replace(~r/^#+\s+/, "") |> String.trim()
  end

  # --- Item Extraction ---

  defp extract_from_section(section, project_id) do
    sentences = split_sentences(section.content)

    Enum.reduce(sentences, [], fn sentence, acc ->
      case classify_sentence(sentence, section.heading) do
        nil -> acc
        {kind, confidence} ->
          case create_knowledge_item(kind, sentence, confidence, section.id, project_id) do
            {:ok, item} -> [item | acc]
            _ -> acc
          end
      end
    end)
    |> Enum.reverse()
  end

  defp classify_sentence(sentence, heading) do
    lower = String.downcase(sentence)
    heading_lower = if heading, do: String.downcase(heading), else: ""

    cond do
      heading_match?(heading_lower, ~w(decision decisions adr)) ->
        {:decision, 0.8}

      heading_match?(heading_lower, ~w(question questions open faq)) ->
        {:question, 0.7}

      heading_match?(heading_lower, ~w(goal goals objective objectives plan plans todo)) ->
        {:intent, 0.7}

      matches_any?(lower, @decision_patterns) ->
        {:decision, 0.6}

      String.contains?(lower, "?") and matches_any?(lower, @question_patterns) ->
        {:question, 0.6}

      matches_any?(lower, @intent_patterns) ->
        {:intent, 0.5}

      matches_any?(lower, @evidence_patterns) ->
        {:evidence, 0.5}

      byte_size(sentence) > 30 and looks_like_entity?(lower) ->
        {:entity, 0.4}

      true ->
        nil
    end
  end

  defp heading_match?("", _terms), do: false

  defp heading_match?(heading, terms) do
    Enum.any?(terms, &String.contains?(heading, &1))
  end

  defp matches_any?(text, patterns) do
    Enum.any?(patterns, &String.contains?(text, &1))
  end

  defp looks_like_entity?(text) do
    # Contains a capitalized proper noun (not at sentence start) or a quoted term
    Regex.match?(~r/\s[A-Z][a-z]+/, text) or String.contains?(text, "\"")
  end

  defp split_sentences(content) do
    content
    |> String.split(~r/(?<=[.!?])\s+|\n+/)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(byte_size(&1) < 10))
  end

  defp create_knowledge_item(kind, text, confidence, section_id, project_id) do
    normalized = text |> String.downcase() |> String.replace(~r/[^a-z0-9\s]/, "") |> String.trim()

    Knowledge.create_item(%{
      kind: Atom.to_string(kind),
      text: String.slice(text, 0, 2000),
      normalized_key: String.slice(normalized, 0, 200),
      confidence: confidence,
      status: "active",
      source_section_id: section_id,
      project_id: project_id
    })
  end

  # --- Helpers ---

  defp upsert_source(path, title, checksum, opts) do
    case Knowledge.get_source_by_path(path) do
      nil ->
        {:ok, source} =
          Knowledge.create_source(%{
            path: path,
            title: title,
            checksum: checksum,
            source_type: Keyword.get(opts, :source_type, "markdown"),
            space_key: Keyword.get(opts, :space_key),
            project_key: Keyword.get(opts, :project_key)
          })

        source

      existing ->
        {:ok, source} =
          Knowledge.update_source(existing, %{
            title: title,
            checksum: checksum,
            source_type: Keyword.get(opts, :source_type, "markdown"),
            space_key: Keyword.get(opts, :space_key),
            project_key: Keyword.get(opts, :project_key)
          })

        source
    end
  end

  defp clear_items_for_sections([]), do: :ok

  defp clear_items_for_sections(section_ids) do
    import Ecto.Query

    Ema.Knowledge.KnowledgeItem
    |> where([i], i.source_section_id in ^section_ids)
    |> Repo.delete_all()
  end

  defp extract_title(content, path) do
    case Regex.run(~r/^#\s+(.+)$/m, content) do
      [_, title] -> String.trim(title)
      nil -> Path.basename(path, Path.extname(path))
    end
  end

  defp slugify(text) do
    text
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s-]/, "")
    |> String.replace(~r/\s+/, "-")
    |> String.slice(0, 100)
  end
end
