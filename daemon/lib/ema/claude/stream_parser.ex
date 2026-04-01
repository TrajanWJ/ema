defmodule Ema.Claude.StreamParser do
  @moduledoc """
  Parses JSONL stream-json events from Claude Code CLI.

  Claude Code with `--output-format stream-json` emits one JSON object per line:
  - system/init: session initialization with tool list
  - assistant: text content from Claude
  - content_block_start: start of tool use
  - content_block_delta: partial tool input
  - content_block_stop: end of tool use block
  - tool_result: result of tool execution
  - result: session complete with cost/tokens
  - system/api_retry: rate limit retry notification
  """

  require Logger

  @doc """
  Parse a chunk of data that may contain multiple JSONL lines.
  Returns {parsed_events, remaining_buffer} where remaining_buffer
  is any incomplete line at the end.
  """
  def parse_chunk(data) when is_binary(data) do
    lines = String.split(data, "\n")

    # Last element might be incomplete (no trailing newline)
    {complete_lines, [remainder]} = Enum.split(lines, -1)

    events =
      complete_lines
      |> Enum.reject(&(&1 == ""))
      |> Enum.flat_map(fn line ->
        case parse_line(line) do
          {:ok, event} -> [event]
          {:error, _reason} -> []
        end
      end)

    {events, remainder}
  end

  @doc """
  Parse a single JSONL line into a structured event.
  """
  def parse_line(line) when is_binary(line) do
    case Jason.decode(line) do
      {:ok, json} -> {:ok, normalize_event(json)}
      {:error, reason} -> {:error, {:json_parse_error, reason, line}}
    end
  end

  # ── Event Normalization ──────────────────────────────────────────────────

  defp normalize_event(%{"type" => "system", "subtype" => "init"} = json) do
    %{
      type: "system_init",
      session_id: json["session_id"],
      tools: json["tools"] || []
    }
  end

  defp normalize_event(%{"type" => "system", "subtype" => "api_retry"} = json) do
    %{
      type: "api_retry",
      delay_seconds: json["delay_seconds"],
      error: json["error"]
    }
  end

  defp normalize_event(%{"type" => "assistant", "message" => message}) do
    text =
      case message do
        %{"content" => content} when is_list(content) ->
          content
          |> Enum.filter(&(&1["type"] == "text"))
          |> Enum.map_join("", & &1["text"])

        _ ->
          nil
      end

    %{
      type: "assistant",
      text: text,
      raw_message: message
    }
  end

  defp normalize_event(%{"type" => "content_block_start", "content_block" => block}) do
    case block do
      %{"type" => "tool_use", "name" => name, "id" => id} ->
        %{type: "tool_use_start", name: name, tool_use_id: id}

      %{"type" => "text"} ->
        %{type: "text_block_start"}

      _ ->
        %{type: "content_block_start", block: block}
    end
  end

  defp normalize_event(%{"type" => "content_block_delta", "delta" => delta}) do
    case delta do
      %{"type" => "input_json_delta", "partial_json" => partial} ->
        %{type: "tool_input_delta", partial_json: partial}

      %{"type" => "text_delta", "text" => text} ->
        %{type: "text_delta", text: text}

      _ ->
        %{type: "content_block_delta", delta: delta}
    end
  end

  defp normalize_event(%{"type" => "content_block_stop"}) do
    %{type: "content_block_stop"}
  end

  defp normalize_event(%{"type" => "tool_result"} = json) do
    %{
      type: "tool_result",
      tool_use_id: json["tool_use_id"],
      content: json["content"]
    }
  end

  defp normalize_event(%{"type" => "result"} = json) do
    %{
      type: "result",
      subtype: json["subtype"],
      session_id: json["session_id"],
      cost: json["total_cost_usd"],
      input_tokens: json["total_input_tokens"],
      output_tokens: json["total_output_tokens"]
    }
  end

  # Catch-all for unknown events
  defp normalize_event(json) do
    %{type: "unknown", raw: json}
  end
end
