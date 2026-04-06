defmodule Ema.IntentionFarmer.Parser do
  @moduledoc "Parses Claude Code and Codex CLI session files into structured data."

  require Logger

  alias Ema.ClaudeSessions.SessionParser

  @type parsed_result :: %{
          session_id: String.t(),
          source_type: String.t(),
          messages: list(map()),
          intents: list(map()),
          tool_call_count: non_neg_integer(),
          files_touched: list(String.t()),
          token_count: non_neg_integer(),
          message_count: non_neg_integer(),
          started_at: DateTime.t() | nil,
          ended_at: DateTime.t() | nil,
          project_path: String.t() | nil,
          model: String.t() | nil,
          model_provider: String.t() | nil,
          raw_path: String.t()
        }

  # --- Public API ---

  @doc """
  Parse a session file at the given path. Auto-detects format based on path.
  Returns {:ok, parsed_result} or {:error, reason}.
  """
  @spec parse(String.t()) :: {:ok, parsed_result()} | {:error, term()}
  def parse(path) do
    cond do
      claude_session?(path) -> parse_claude_session(path)
      claude_task?(path) -> parse_claude_task(path)
      codex_session?(path) -> parse_codex_session(path)
      codex_history?(path) -> parse_codex_history(path)
      openclaw_source?(path) -> parse_openclaw_source(path)
      external_import?(path) -> parse_external_import(path)
      claude_md?(path) -> parse_claude_md(path)
      true -> {:error, :unknown_format}
    end
  end

  @doc "Parse a Claude Code JSONL session file."
  def parse_claude_session(path) do
    case SessionParser.parse_file(path) do
      {:ok, parsed} ->
        intents = extract_intents(parsed.messages, "claude_code")

        {:ok,
         %{
           session_id: parsed.session_id,
           source_type: "claude_code",
           messages: parsed.messages,
           intents: intents,
           tool_call_count: parsed.tool_calls,
           files_touched: parsed.files_touched,
           token_count: parsed.token_count,
           message_count: length(parsed.messages),
           started_at: parsed.started_at,
           ended_at: parsed.ended_at,
           project_path: parsed.project_path,
           model: nil,
           model_provider: "anthropic",
           raw_path: path
         }}

      error ->
        error
    end
  end

  @doc "Parse a Codex CLI JSONL session file."
  def parse_codex_session(path) do
    lines =
      path
      |> File.stream!()
      |> Stream.map(&parse_jsonl_line/1)
      |> Stream.reject(&is_nil/1)
      |> Enum.to_list()

    if lines == [] do
      {:error, :empty_session}
    else
      meta = Enum.find(lines, &(&1["type"] == "session_meta"))
      payload = (meta && meta["payload"]) || %{}

      session_id = payload["id"] || Path.basename(path, ".jsonl")
      model = payload["model"]
      model_provider = payload["model_provider"] || "openai"
      project_path = payload["cwd"]

      messages =
        Enum.filter(lines, &(&1["type"] in ["response_item", "event_msg", "turn_context"]))

      tool_calls = count_codex_tool_calls(lines)
      files = extract_codex_files(lines)
      {started_at, ended_at} = extract_codex_timestamps(lines)
      token_count = extract_codex_tokens(lines)
      intents = extract_intents_from_codex(lines)

      {:ok,
       %{
         session_id: session_id,
         source_type: "codex_cli",
         messages: messages,
         intents: intents,
         tool_call_count: tool_calls,
         files_touched: files,
         token_count: token_count,
         message_count: length(messages),
         started_at: started_at,
         ended_at: ended_at,
         project_path: project_path,
         model: model,
         model_provider: model_provider,
         raw_path: path
       }}
    end
  rescue
    e ->
      Logger.warning(
        "[IntentionFarmer.Parser] Failed to parse codex session #{path}: #{Exception.message(e)}"
      )

      {:error, {:parse_failed, Exception.message(e)}}
  end

  @doc "Parse the Codex CLI history file (~/.codex/history.jsonl)."
  def parse_codex_history(path) do
    lines =
      path
      |> File.stream!()
      |> Stream.map(&parse_jsonl_line/1)
      |> Stream.reject(&is_nil/1)
      |> Enum.to_list()

    intents =
      lines
      |> Enum.map(fn line ->
        %{
          content: line["text"] || "",
          intent_type: classify_intent(line["text"] || ""),
          source_type: "codex_history",
          session_id: line["session_id"],
          timestamp: parse_unix_ts(line["ts"])
        }
      end)
      |> Enum.reject(&(&1.content == ""))

    {:ok,
     %{
       source_type: "codex_history",
       intents: intents,
       raw_path: path
     }}
  rescue
    e ->
      Logger.warning(
        "[IntentionFarmer.Parser] Failed to parse codex history: #{Exception.message(e)}"
      )

      {:error, {:parse_failed, Exception.message(e)}}
  end

  @doc "Parse a Claude task JSON file from ~/.claude/tasks."
  def parse_claude_task(path) do
    with {:ok, content} <- File.read(path),
         {:ok, data} <- Jason.decode(content) do
      task_dir = Path.dirname(path)
      session_id = Path.basename(task_dir)
      title = data["subject"] || data["title"] || "Claude task"
      description = data["description"] || data["activeForm"] || ""
      combined = Enum.join(Enum.reject([title, description], &(&1 in [nil, ""])), ": ")

      {:ok,
       %{
         session_id: session_id,
         source_type: "claude_task",
         messages: [%{"role" => "user", "text" => combined}],
         intents: build_single_intent(combined, "claude_task"),
         tool_call_count: 0,
         files_touched: [],
         token_count: 0,
         message_count: 1,
         started_at: nil,
         ended_at: nil,
         project_path: nil,
         model: nil,
         model_provider: "anthropic",
         raw_path: path,
         metadata: %{
           "task_id" => data["id"],
           "status" => data["status"],
           "blocks" => data["blocks"] || [],
           "blocked_by" => data["blockedBy"] || []
         }
       }}
    else
      {:error, reason} -> {:error, {:parse_failed, reason}}
    end
  rescue
    e ->
      Logger.warning(
        "[IntentionFarmer.Parser] Failed to parse claude task #{path}: #{Exception.message(e)}"
      )

      {:error, {:parse_failed, Exception.message(e)}}
  end

  @doc "Parse a CLAUDE.md file for project context."
  def parse_claude_md(path) do
    case File.read(path) do
      {:ok, content} ->
        {:ok,
         %{
           source_type: "claude_md",
           content: content,
           raw_path: path,
           project_path: infer_project_from_claude_md(path)
         }}

      {:error, reason} ->
        {:error, {:file_read_failed, reason}}
    end
  end

  @doc "Parse an OpenClaw source file under ~/.openclaw."
  def parse_openclaw_source(path) do
    cond do
      String.ends_with?(path, "openclaw.json") -> parse_openclaw_config(path)
      String.ends_with?(path, ".jsonl") -> parse_openclaw_event(path)
      String.ends_with?(path, ".log") -> parse_openclaw_log(path)
      true -> {:error, :unknown_openclaw_format}
    end
  end

  @doc "Parse a manually staged external import file."
  def parse_external_import(path) do
    ext = path |> Path.extname() |> String.downcase()
    stat = File.stat!(path)

    provider = provider_guess_from_path(path)
    dataset = dataset_guess_from_path(path)
    title = Path.basename(path)

    {preview, metadata} =
      case ext do
        ".zip" -> parse_archive_preview(path)
        ".tar" -> parse_archive_preview(path)
        ".gz" -> parse_archive_preview(path)
        ".tgz" -> parse_archive_preview(path)
        ".json" -> parse_json_preview(path)
        ".jsonl" -> parse_json_preview(path)
        ".csv" -> parse_text_preview(path)
        ".txt" -> parse_text_preview(path)
        ".md" -> parse_text_preview(path)
        ".html" -> parse_text_preview(path)
        ".htm" -> parse_text_preview(path)
        _ -> {"External file staged for import", %{}}
      end

    content = "#{title}: #{preview}"

    {:ok,
     %{
       session_id: Path.basename(path),
       source_type: "external_import",
       messages: [%{"role" => "user", "text" => content}],
       intents: build_single_intent(content, "external_import"),
       tool_call_count: 0,
       files_touched: [path],
       token_count: String.length(preview),
       message_count: 1,
       started_at: file_mtime(stat),
       ended_at: file_mtime(stat),
       project_path: nil,
       model: nil,
       model_provider: provider,
       raw_path: path,
       metadata:
         Map.merge(metadata, %{
           "provider_guess" => provider,
           "dataset_guess" => dataset,
           "preview" => preview,
           "size_bytes" => stat.size
         })
     }}
  rescue
    e ->
      Logger.warning(
        "[IntentionFarmer.Parser] Failed to parse external import #{path}: #{Exception.message(e)}"
      )

      {:error, {:parse_failed, Exception.message(e)}}
  end

  # --- Intent Extraction ---

  @doc "Extract intents from a list of parsed messages."
  def extract_intents(messages, source_type) do
    messages
    |> Enum.filter(&is_human_message?/1)
    |> Enum.with_index()
    |> Enum.filter(fn {_msg, idx} -> idx == 0 or idx < 3 end)
    |> Enum.map(fn {msg, _idx} ->
      content = extract_message_content(msg)

      %{
        content: content,
        intent_type: classify_intent(content),
        source_type: source_type
      }
    end)
    |> Enum.reject(&(&1.content == ""))
  end

  # --- Classification ---

  @doc "Classify a text string into an intent type."
  def classify_intent(text) when is_binary(text) do
    text_lower = String.downcase(text)

    cond do
      Regex.match?(~r/\b(fix|bug|error|broken|crash|fail)\b/, text_lower) -> "fix"
      Regex.match?(~r/\b(add|create|build|implement|write|make)\b/, text_lower) -> "task"
      Regex.match?(~r/\b(why|how|what|where|explain|understand)\b/, text_lower) -> "question"
      Regex.match?(~r/\b(explore|look|check|investigate|find)\b/, text_lower) -> "exploration"
      true -> "goal"
    end
  end

  def classify_intent(_), do: "goal"

  # --- Source Detection ---

  defp claude_session?(path) do
    String.contains?(path, ".claude/projects") and String.ends_with?(path, ".jsonl")
  end

  defp claude_task?(path) do
    String.contains?(path, ".claude/tasks") and String.ends_with?(path, ".json")
  end

  defp codex_session?(path) do
    String.contains?(path, ".codex/sessions") and String.ends_with?(path, ".jsonl")
  end

  defp codex_history?(path), do: String.ends_with?(path, ".codex/history.jsonl")
  defp openclaw_source?(path), do: String.contains?(path, ".openclaw/")

  defp external_import?(path) do
    String.contains?(path, "/ema/imports/") or
      String.contains?(String.downcase(path), "/downloads/")
  end

  defp claude_md?(path), do: String.ends_with?(path, "CLAUDE.md")

  # --- Private Helpers ---

  defp parse_jsonl_line(line) do
    case Jason.decode(String.trim(line)) do
      {:ok, data} -> data
      {:error, _} -> nil
    end
  end

  defp is_human_message?(msg) do
    msg["type"] == "human" or msg["role"] == "user"
  end

  defp extract_message_content(%{"content" => content}) when is_binary(content) do
    String.trim(content)
  end

  defp extract_message_content(%{"content" => [%{"text" => text} | _]}) when is_binary(text) do
    String.trim(text)
  end

  defp extract_message_content(%{"text" => text}) when is_binary(text) do
    String.trim(text)
  end

  defp extract_message_content(_), do: ""

  defp count_codex_tool_calls(lines) do
    lines
    |> Enum.filter(&(&1["type"] == "response_item"))
    |> Enum.count(fn item ->
      payload = item["payload"] || %{}
      role = payload["role"]
      content = payload["content"] || []

      role == "assistant" and is_list(content) and
        Enum.any?(content, &(&1["type"] == "function_call"))
    end)
  end

  defp extract_codex_files(lines) do
    lines
    |> Enum.filter(&(&1["type"] == "response_item"))
    |> Enum.flat_map(fn item ->
      content = get_in(item, ["payload", "content"]) || []

      Enum.flat_map(List.wrap(content), fn
        %{"type" => "function_call", "arguments" => args} when is_binary(args) ->
          case Jason.decode(args) do
            {:ok, %{"file_path" => p}} when is_binary(p) -> [p]
            {:ok, %{"path" => p}} when is_binary(p) -> [p]
            _ -> []
          end

        _ ->
          []
      end)
    end)
    |> Enum.uniq()
    |> Enum.sort()
  end

  defp extract_codex_timestamps(lines) do
    timestamps =
      Enum.flat_map(lines, fn line ->
        case line["timestamp"] || line["ts"] do
          nil ->
            []

          ts when is_integer(ts) ->
            [DateTime.from_unix!(ts)]

          ts when is_float(ts) ->
            [DateTime.from_unix!(trunc(ts))]

          ts when is_binary(ts) ->
            case DateTime.from_iso8601(ts) do
              {:ok, dt, _} -> [dt]
              _ -> []
            end

          _ ->
            []
        end
      end)

    case timestamps do
      [] -> {nil, nil}
      [single] -> {single, single}
      many -> {List.first(many), List.last(many)}
    end
  end

  defp extract_codex_tokens(lines) do
    Enum.reduce(lines, 0, fn line, acc ->
      usage = line["usage"] || get_in(line, ["payload", "usage"]) || %{}
      input = usage["input_tokens"] || 0
      output = usage["output_tokens"] || 0
      acc + input + output
    end)
  end

  defp extract_intents_from_codex(lines) do
    lines
    |> Enum.filter(fn line ->
      (line["type"] == "event_msg" and get_in(line, ["payload", "role"]) == "user") or
        line["type"] == "turn_context"
    end)
    |> Enum.take(3)
    |> Enum.map(fn line ->
      content =
        get_in(line, ["payload", "content"]) || get_in(line, ["payload", "text"]) || ""

      content =
        if is_list(content),
          do: Enum.map_join(content, " ", &(&1["text"] || "")),
          else: content

      %{
        content: String.trim(to_string(content)),
        intent_type: classify_intent(to_string(content)),
        source_type: "codex_cli"
      }
    end)
    |> Enum.reject(&(&1.content == ""))
  end

  defp parse_unix_ts(nil), do: nil
  defp parse_unix_ts(ts) when is_integer(ts), do: DateTime.from_unix!(ts)
  defp parse_unix_ts(ts) when is_float(ts), do: DateTime.from_unix!(trunc(ts))
  defp parse_unix_ts(_), do: nil

  defp infer_project_from_claude_md(path) do
    Path.dirname(path)
  end

  defp build_single_intent("", _source_type), do: []

  defp build_single_intent(content, source_type) do
    [
      %{
        content: content,
        intent_type: classify_intent(content),
        source_type: source_type
      }
    ]
  end

  defp parse_openclaw_event(path) do
    parsed = decode_json_file(path)
    data = normalize_event_payload(parsed)
    event = data["event"] || "openclaw_event"
    timestamp = parse_unix_ts(data["timestamp"]) || file_mtime(File.stat!(path))
    details = Jason.encode!(Map.get(data, "data", %{}))
    content = "#{event}: #{String.slice(details, 0, 800)}"

    {:ok,
     %{
       session_id: Path.basename(path),
       source_type: "openclaw_event",
       messages: [%{"role" => "user", "text" => content}],
       intents: build_single_intent(content, "openclaw_event"),
       tool_call_count: 0,
       files_touched: [],
       token_count: String.length(content),
       message_count: 1,
       started_at: timestamp,
       ended_at: timestamp,
       project_path: nil,
       model: nil,
       model_provider: "openclaw",
       raw_path: path,
       metadata: %{"event" => event, "data" => Map.get(data, "data", %{})}
     }}
  end

  defp parse_openclaw_log(path) do
    {preview, _meta} = parse_text_preview(path)
    ts = file_mtime(File.stat!(path))
    content = "#{Path.basename(path)}: #{preview}"

    {:ok,
     %{
       session_id: Path.basename(path),
       source_type: "openclaw_event",
       messages: [%{"role" => "user", "text" => content}],
       intents: build_single_intent(content, "openclaw_event"),
       tool_call_count: 0,
       files_touched: [],
       token_count: String.length(content),
       message_count: 1,
       started_at: ts,
       ended_at: ts,
       project_path: nil,
       model: nil,
       model_provider: "openclaw",
       raw_path: path,
       metadata: %{"preview" => preview}
     }}
  end

  defp parse_openclaw_config(path) do
    with {:ok, content} <- File.read(path),
         {:ok, data} <- Jason.decode(content) do
      agents =
        get_in(data, ["agents", "list"])
        |> List.wrap()
        |> Enum.map(&(&1["id"] || &1["name"]))
        |> Enum.reject(&is_nil/1)

      content = "OpenClaw config with agents: #{Enum.join(agents, ", ")}"

      {:ok,
       %{
         session_id: "openclaw-config",
         source_type: "openclaw_config",
         messages: [%{"role" => "user", "text" => content}],
         intents: build_single_intent(content, "openclaw_config"),
         tool_call_count: 0,
         files_touched: [],
         token_count: String.length(content),
         message_count: 1,
         started_at: file_mtime(File.stat!(path)),
         ended_at: file_mtime(File.stat!(path)),
         project_path: nil,
         model: nil,
         model_provider: "openclaw",
         raw_path: path,
         metadata: %{"agents" => agents, "gateway" => data["gateway"] || %{}}
       }}
    end
  end

  defp decode_json_file(path) do
    with {:ok, content} <- File.read(path) do
      case Jason.decode(content) do
        {:ok, data} ->
          {:ok, data}

        _ ->
          path
          |> File.stream!()
          |> Stream.map(&parse_jsonl_line/1)
          |> Stream.reject(&is_nil/1)
          |> Enum.to_list()
          |> case do
            [single] -> {:ok, single}
            many when is_list(many) and many != [] -> {:ok, %{"entries" => many}}
            _ -> {:error, :invalid_json}
          end
      end
    end
  end

  defp normalize_event_payload({:ok, %{"entries" => [first | _]}}), do: first
  defp normalize_event_payload({:ok, data}) when is_map(data), do: data
  defp normalize_event_payload(_), do: %{}

  defp parse_json_preview(path) do
    case decode_json_file(path) do
      {:ok, data} ->
        preview =
          data
          |> inspect(pretty: true, limit: 20, printable_limit: 1500)
          |> String.slice(0, 1200)

        {preview, %{}}

      {:error, _} ->
        {"JSON file staged for import", %{}}
    end
  end

  defp parse_archive_preview(path) do
    entries =
      case archive_entries(path) do
        {:ok, list} -> list
        _ -> []
      end

    preview =
      case entries do
        [] ->
          "Archive staged for import"

        many ->
          sample = many |> Enum.take(12) |> Enum.join(", ")
          "Archive contains #{length(many)} entries. Sample: #{sample}"
      end

    metadata = %{
      "archive" => true,
      "entry_count" => length(entries),
      "sample_entries" => Enum.take(entries, 25)
    }

    {preview, metadata}
  end

  defp parse_text_preview(path) do
    preview =
      path
      |> File.stream!([], 2048)
      |> Enum.take(20)
      |> Enum.join("")
      |> String.replace(~r/\s+/, " ")
      |> String.trim()
      |> String.slice(0, 1200)

    {preview, %{}}
  rescue
    _ -> {"Text file staged for import", %{}}
  end

  defp provider_guess_from_path(path) do
    lower = String.downcase(path)

    cond do
      String.contains?(lower, "chatgpt") or String.contains?(lower, "openai") -> "openai"
      String.contains?(lower, "github") -> "github"
      String.contains?(lower, "google") or String.contains?(lower, "takeout") -> "google"
      String.contains?(lower, "apple") -> "apple"
      String.contains?(lower, "facebook") or String.contains?(lower, "instagram") -> "meta"
      true -> "external"
    end
  end

  defp dataset_guess_from_path(path) do
    lower = String.downcase(path)

    cond do
      String.contains?(lower, "chatgpt") -> "chatgpt_export"
      String.contains?(lower, "takeout") -> "google_takeout"
      String.contains?(lower, "github") -> "github_export"
      String.contains?(lower, "apple") -> "apple_privacy_export"
      String.contains?(lower, "facebook") or String.contains?(lower, "instagram") ->
        "meta_export"
      true ->
        "generic_import"
    end
  end

  defp archive_entries(path) do
    lower = String.downcase(path)
    char_path = String.to_charlist(path)

    cond do
      String.ends_with?(lower, ".zip") ->
        case :zip.table(char_path) do
          {:ok, entries} -> {:ok, Enum.map(entries, &zip_entry_name/1)}
          error -> error
        end

      String.ends_with?(lower, ".tar") or String.ends_with?(lower, ".tar.gz") or
          String.ends_with?(lower, ".tgz") or String.ends_with?(lower, ".gz") ->
        case :erl_tar.table(char_path, [:compressed]) do
          {:ok, entries} -> {:ok, Enum.map(entries, &to_string/1)}
          error -> error
        end

      true ->
        {:error, :unsupported_archive}
    end
  end

  defp zip_entry_name({name, _info}), do: to_string(name)
  defp zip_entry_name(name), do: to_string(name)

  defp file_mtime(%File.Stat{mtime: mtime}) when is_integer(mtime), do: DateTime.from_unix!(mtime)
  defp file_mtime(_), do: nil
end
