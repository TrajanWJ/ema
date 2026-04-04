defmodule Ema.Superman.IntentParser do
  @moduledoc """
  Parses `.superman` files into project intelligence nodes.
  """

  @section_types ~w(goal approach constraints prior_outcomes)

  def parse(content, opts \\ []) when is_binary(content) do
    {frontmatter, body} = split_frontmatter(content)
    metadata = parse_frontmatter(frontmatter)
    title = metadata["title"] || keyword_title(opts[:source]) || "Superman Intent"
    base_tags = normalize_tags(metadata["tags"])
    inserted_at = DateTime.utc_now() |> DateTime.truncate(:second)

    body
    |> split_sections()
    |> Enum.flat_map(fn {section, section_content} ->
      build_nodes(section, section_content, title, base_tags, inserted_at)
    end)
  end

  def parse_file(path) when is_binary(path) do
    case File.read(path) do
      {:ok, content} -> {:ok, parse(content, source: path)}
      {:error, reason} -> {:error, reason}
    end
  end

  defp split_frontmatter(content) do
    case Regex.run(~r/\A---\s*\n(.*?)\n---\s*\n?(.*)\z/s, content) do
      [_, frontmatter, body] -> {frontmatter, body}
      _ -> {"", content}
    end
  end

  defp parse_frontmatter(frontmatter) do
    lines = String.split(frontmatter, ~r/\r?\n/)

    Enum.reduce(lines, {%{}, nil}, fn line, {acc, list_key} ->
      trimmed = String.trim(line)

      cond do
        trimmed == "" ->
          {acc, list_key}

        String.starts_with?(trimmed, "- ") and is_binary(list_key) ->
          item = trimmed |> String.replace_prefix("- ", "") |> clean_frontmatter_value()
          {Map.update(acc, list_key, [item], &(&1 ++ [item])), list_key}

        Regex.match?(~r/^[A-Za-z0-9_-]+:/, trimmed) ->
          [key, raw_value] = String.split(trimmed, ":", parts: 2)
          parsed_value = parse_frontmatter_value(raw_value)
          next_key = if parsed_value == :list, do: key, else: nil
          next_acc = if parsed_value == :list, do: Map.put(acc, key, []), else: Map.put(acc, key, parsed_value)
          {next_acc, next_key}

        true ->
          {acc, list_key}
      end
    end)
    |> elem(0)
  end

  defp parse_frontmatter_value(raw_value) do
    value = raw_value |> String.trim()

    cond do
      value == "" ->
        :list

      String.starts_with?(value, "[") and String.ends_with?(value, "]") ->
        value
        |> String.trim_leading("[")
        |> String.trim_trailing("]")
        |> String.split(",", trim: true)
        |> Enum.map(&clean_frontmatter_value/1)

      true ->
        clean_frontmatter_value(value)
    end
  end

  defp clean_frontmatter_value(value) do
    value
    |> String.trim()
    |> String.trim_leading("\"")
    |> String.trim_trailing("\"")
    |> String.trim_leading("'")
    |> String.trim_trailing("'")
    |> String.trim()
  end

  defp split_sections(body) do
    body
    |> String.split(~r/\r?\n/)
    |> Enum.reduce({nil, [], %{}}, fn line, {current, current_lines, acc} ->
      case parse_heading(line) do
        nil ->
          {current, [line | current_lines], acc}

        heading ->
          next_acc = store_section(acc, current, current_lines)
          {heading, [], next_acc}
      end
    end)
    |> then(fn {current, current_lines, acc} -> store_section(acc, current, current_lines) end)
    |> Enum.filter(fn {section, content} -> section in @section_types and content != "" end)
  end

  defp parse_heading(line) do
    case Regex.run(~r/^\s{0,3}\#{1,6}\s+(.+?)\s*$/, line) do
      [_, heading] -> normalize_heading(heading)
      _ -> nil
    end
  end

  defp normalize_heading(heading) do
    heading
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/, "_")
    |> String.trim("_")
  end

  defp store_section(acc, nil, _lines), do: acc

  defp store_section(acc, section, lines) do
    content =
      lines
      |> Enum.reverse()
      |> Enum.join("\n")
      |> String.trim()

    if content == "" do
      acc
    else
      Map.update(acc, section, content, fn existing -> existing <> "\n\n" <> content end)
    end
  end

  defp build_nodes("constraints", content, title, base_tags, inserted_at) do
    build_list_like_nodes("constraints", "Constraint", content, title, base_tags, inserted_at)
  end

  defp build_nodes("prior_outcomes", content, title, base_tags, inserted_at) do
    build_list_like_nodes("prior_outcomes", "Prior Outcome", content, title, base_tags, inserted_at)
  end

  defp build_nodes(section, content, title, base_tags, inserted_at) do
    [
      %{
        type: section,
        title: "#{title} #{humanize_section(section)}",
        content: content,
        tags: Enum.uniq(base_tags ++ [section]),
        inserted_at: inserted_at
      }
    ]
  end

  defp build_list_like_nodes(section, label, content, title, base_tags, inserted_at) do
    items = split_list_items(content)

    case items do
      [] ->
        [
          %{
            type: section,
            title: "#{title} #{humanize_section(section)}",
            content: content,
            tags: Enum.uniq(base_tags ++ [section]),
            inserted_at: inserted_at
          }
        ]

      entries ->
        Enum.with_index(entries, 1)
        |> Enum.map(fn {entry, index} ->
          %{
            type: section,
            title: "#{title} #{label} #{index}",
            content: entry,
            tags: Enum.uniq(base_tags ++ [section]),
            inserted_at: inserted_at
          }
        end)
    end
  end

  defp split_list_items(content) do
    lines = String.split(content, ~r/\r?\n/)

    {items, current} =
      Enum.reduce(lines, {[], []}, fn line, {acc, current_lines} ->
        trimmed = String.trim(line)

        cond do
          trimmed == "" and current_lines == [] ->
            {acc, current_lines}

          String.starts_with?(trimmed, "- ") or Regex.match?(~r/^\d+\.\s+/, trimmed) ->
            next_acc = maybe_append_item(acc, current_lines)
            item = trimmed |> String.replace_prefix("- ", "") |> String.replace(~r/^\d+\.\s+/, "")
            {next_acc, [item]}

          true ->
            {acc, current_lines ++ [trimmed]}
        end
      end)

    items
    |> maybe_append_item(current)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp maybe_append_item(acc, []), do: acc
  defp maybe_append_item(acc, lines), do: acc ++ [Enum.join(lines, "\n")]

  defp normalize_tags(tags) when is_list(tags) do
    tags
    |> Enum.map(&to_string/1)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp normalize_tags(tags) when is_binary(tags) do
    tags
    |> String.split(",", trim: true)
    |> normalize_tags()
  end

  defp normalize_tags(_), do: []

  defp keyword_title(nil), do: nil

  defp keyword_title(source) do
    source
    |> Path.basename()
    |> Path.rootname()
    |> String.replace(~r/[-_]+/, " ")
    |> String.trim()
    |> case do
      "" -> nil
      base -> String.replace(base, ~r/\bsuperman\b/i, "") |> String.trim() |> blank_to_nil()
    end
  end

  defp blank_to_nil(""), do: nil
  defp blank_to_nil(value), do: value

  defp humanize_section(section) do
    section
    |> String.replace("_", " ")
    |> String.split()
    |> Enum.map_join(" ", &String.capitalize/1)
  end
end
