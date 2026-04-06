defmodule Ema.Ingestor.ImportWorkspace do
  @moduledoc "Stages import inputs into EMA's managed import workspace."

  @workspace_root Path.expand("~/.local/share/ema/imports")

  def workspace_root, do: @workspace_root

  def stage(params) do
    File.mkdir_p!(@workspace_root)

    source_type = get_param(params, "source_type") || "file"

    case source_type do
      "file" -> stage_file(params)
      "file_path" -> stage_file(params)
      "text" -> stage_text(params)
      "clipboard" -> stage_text(params)
      "url" -> stage_url(params)
      _ -> {:error, :unsupported_source_type}
    end
  end

  defp stage_file(params) do
    source_path = get_param(params, "source_uri") || get_param(params, "file_path")

    cond do
      is_nil(source_path) or source_path == "" ->
        {:error, :missing_source_uri}

      not File.exists?(source_path) ->
        {:error, :source_not_found}

      true ->
        ext = Path.extname(source_path)
        target = unique_target_path("import-file", ext, source_path)
        File.cp!(source_path, target)

        {:ok,
         %{
           staged_path: target,
           file_name: Path.basename(target),
           original_source_type: "file",
           original_source_uri: source_path
         }}
    end
  end

  defp stage_text(params) do
    content = get_param(params, "content")

    if is_binary(content) and String.trim(content) != "" do
      target = unique_target_path("import-text", ".md", content)
      title = get_param(params, "title") || "Imported Text"

      body = """
      # #{title}

      Imported via EMA at #{DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()}

      #{String.trim(content)}
      """

      File.write!(target, body)

      {:ok,
       %{
         staged_path: target,
         file_name: Path.basename(target),
         original_source_type: get_param(params, "source_type") || "text"
       }}
    else
      {:error, :missing_content}
    end
  end

  defp stage_url(params) do
    url = get_param(params, "source_uri") || get_param(params, "url")

    if is_binary(url) and String.trim(url) != "" do
      target = unique_target_path("import-url", ".md", url)
      title = get_param(params, "title") || "Imported URL"

      body = """
      # #{title}

      Imported via EMA at #{DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()}

      Source URL: #{String.trim(url)}
      """

      File.write!(target, body)

      {:ok,
       %{
         staged_path: target,
         file_name: Path.basename(target),
         original_source_type: "url",
         original_source_uri: url
       }}
    else
      {:error, :missing_source_uri}
    end
  end

  defp unique_target_path(prefix, ext, entropy_source) do
    ext = if ext in [nil, ""], do: ".txt", else: ext
    timestamp = Calendar.strftime(DateTime.utc_now(), "%Y%m%d-%H%M%S")
    digest = short_hash(to_string(entropy_source))
    file_name = "#{prefix}-#{timestamp}-#{digest}#{ext}"
    Path.join(@workspace_root, file_name)
  end

  defp short_hash(value) do
    value
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.encode16(case: :lower)
    |> binary_part(0, 10)
  end

  defp get_param(params, key) when is_map(params) do
    Map.get(params, key) || Map.get(params, String.to_atom(key))
  end
end
