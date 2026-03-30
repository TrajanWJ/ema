defmodule Ema.ClaudeSessions.SessionParser do
  @moduledoc """
  Parses Claude Code JSONL session files into structured data.
  Not a GenServer — pure functions only.
  """

  require Logger

  @type parsed_session :: %{
          session_id: String.t(),
          messages: list(map()),
          tool_calls: non_neg_integer(),
          files_touched: list(String.t()),
          token_count: non_neg_integer(),
          started_at: DateTime.t() | nil,
          ended_at: DateTime.t() | nil,
          project_path: String.t() | nil
        }

  @doc """
  Parse a JSONL file at the given path.
  Returns {:ok, parsed_session} or {:error, reason}.
  """
  @spec parse_file(String.t()) :: {:ok, parsed_session()} | {:error, term()}
  def parse_file(path) do
    case File.read(path) do
      {:ok, content} -> parse_content(content, path)
      {:error, reason} -> {:error, {:file_read_failed, reason}}
    end
  end

  @doc """
  Parse JSONL content string directly.
  Useful for testing without filesystem.
  """
  @spec parse_content(String.t(), String.t() | nil) ::
          {:ok, parsed_session()} | {:error, term()}
  def parse_content(content, source_path \\ nil) do
    lines =
      content
      |> String.split("\n", trim: true)
      |> Enum.map(&parse_line/1)
      |> Enum.reject(&is_nil/1)

    if lines == [] do
      {:error, :empty_session}
    else
      {:ok, build_session(lines, source_path)}
    end
  end

  defp parse_line(line) do
    case Jason.decode(line) do
      {:ok, data} -> data
      {:error, _} ->
        Logger.debug("Skipping malformed JSONL line: #{String.slice(line, 0..80)}")
        nil
    end
  end

  defp build_session(messages, source_path) do
    session_id = extract_session_id(messages, source_path)
    tool_calls = count_tool_calls(messages)
    files = extract_files_touched(messages)
    tokens = extract_token_count(messages)
    {started_at, ended_at} = extract_timestamps(messages)
    project_path = extract_project_path(messages, source_path)

    %{
      session_id: session_id,
      messages: messages,
      tool_calls: tool_calls,
      files_touched: files,
      token_count: tokens,
      started_at: started_at,
      ended_at: ended_at,
      project_path: project_path
    }
  end

  defp extract_session_id(messages, source_path) do
    # Try to find session_id in message metadata, fall back to filename
    messages
    |> Enum.find_value(fn msg -> msg["sessionId"] || msg["session_id"] end)
    |> case do
      nil when is_binary(source_path) -> Path.basename(source_path, ".jsonl")
      nil -> "unknown_#{System.system_time(:millisecond)}"
      id -> id
    end
  end

  defp count_tool_calls(messages) do
    Enum.count(messages, fn msg ->
      msg["type"] == "tool_use" or msg["type"] == "tool_call" or
        (is_map(msg["content"]) and msg["content"]["type"] == "tool_use") or
        is_list(msg["content"]) and Enum.any?(List.wrap(msg["content"]), fn c ->
          is_map(c) and c["type"] == "tool_use"
        end)
    end)
  end

  defp extract_files_touched(messages) do
    messages
    |> Enum.flat_map(&extract_file_refs/1)
    |> Enum.uniq()
    |> Enum.sort()
  end

  defp extract_file_refs(msg) do
    # Look for file paths in tool inputs (Read, Edit, Write, Bash)
    content_list = List.wrap(msg["content"] || [])

    Enum.flat_map(content_list, fn
      %{"type" => "tool_use", "input" => input} when is_map(input) ->
        extract_paths_from_input(input)

      %{"type" => "tool_result", "content" => c} when is_binary(c) ->
        extract_paths_from_text(c)

      _ ->
        []
    end)
  end

  defp extract_paths_from_input(input) do
    paths =
      [input["file_path"], input["path"], input["file"]]
      |> Enum.reject(&is_nil/1)
      |> Enum.filter(&String.starts_with?(&1, "/"))

    # Also check Bash commands for file references
    case input["command"] do
      cmd when is_binary(cmd) -> paths ++ extract_paths_from_text(cmd)
      _ -> paths
    end
  end

  defp extract_paths_from_text(text) do
    # Simple heuristic: extract absolute paths from text
    Regex.scan(~r{(?:^|\s)(/[a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)}, text)
    |> Enum.map(fn [_, path] -> path end)
  end

  defp extract_token_count(messages) do
    messages
    |> Enum.reduce(0, fn msg, acc ->
      usage = msg["usage"] || %{}
      input = usage["input_tokens"] || 0
      output = usage["output_tokens"] || 0
      acc + input + output
    end)
  end

  defp extract_timestamps(messages) do
    timestamps =
      messages
      |> Enum.flat_map(fn msg ->
        case msg["timestamp"] || msg["ts"] do
          nil -> []
          ts when is_binary(ts) -> parse_timestamp(ts)
          ts when is_integer(ts) -> [DateTime.from_unix!(ts, :millisecond)]
          _ -> []
        end
      end)

    case timestamps do
      [] -> {nil, nil}
      [single] -> {single, single}
      many -> {List.first(many), List.last(many)}
    end
  end

  defp parse_timestamp(ts) do
    case DateTime.from_iso8601(ts) do
      {:ok, dt, _} -> [dt]
      _ -> []
    end
  end

  defp extract_project_path(messages, source_path) do
    # Try message metadata first
    path_from_messages =
      messages
      |> Enum.find_value(fn msg ->
        msg["projectPath"] || msg["project_path"] || msg["cwd"]
      end)

    path_from_messages || infer_project_path(source_path)
  end

  defp infer_project_path(nil), do: nil

  defp infer_project_path(source_path) do
    # ~/.claude/projects/<encoded-path>/sessions/<file>.jsonl
    # The encoded path segment often contains the project directory
    parts = Path.split(source_path)

    case Enum.find_index(parts, &(&1 == "projects")) do
      nil ->
        nil

      idx ->
        # The next segment after "projects" is typically the encoded project path
        case Enum.at(parts, idx + 1) do
          nil -> nil
          encoded -> decode_project_path(encoded)
        end
    end
  end

  defp decode_project_path(encoded) do
    # Claude stores project paths with slashes replaced by hyphens or encoded
    decoded = String.replace(encoded, "-", "/")

    if String.starts_with?(decoded, "/") do
      decoded
    else
      "/" <> decoded
    end
  end
end
