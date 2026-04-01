defmodule Ema.Claude.StreamParser do
  @moduledoc """
  Parses Claude CLI stream-json (JSONL) events into tagged tuples.

  The Claude CLI with `--output-format stream-json` emits one JSON object per line.
  Each object has a "type" field indicating the event kind.
  """

  @doc """
  Parse a single JSON line from the stream.

  Returns a tagged tuple like:
    {:init, map}
    {:text, binary}
    {:content_block_start, map}
    {:content_block_delta, map}
    {:content_block_stop, map}
    {:result, map}
    {:error, map}
    {:unknown, map}
  """
  @spec parse_line(binary()) :: {:ok, tuple()} | {:error, term()}
  def parse_line(line) when is_binary(line) do
    line = String.trim(line)

    if line == "" do
      :skip
    else
      case Jason.decode(line) do
        {:ok, %{"type" => type} = event} ->
          {:ok, classify(type, event)}

        {:ok, event} ->
          {:ok, {:unknown, event}}

        {:error, reason} ->
          {:error, {:json_decode, reason}}
      end
    end
  end

  @doc """
  Parse multiple lines (a chunk of JSONL data) into a list of events.
  Skips blank lines and collects parse errors.
  """
  @spec parse_chunk(binary()) :: [tuple()]
  def parse_chunk(data) when is_binary(data) do
    data
    |> String.split("\n", trim: true)
    |> Enum.flat_map(fn line ->
      case parse_line(line) do
        {:ok, event} -> [event]
        :skip -> []
        {:error, _} -> []
      end
    end)
  end

  # --- Event classification ---

  defp classify("system", %{"subtype" => "init"} = event) do
    {:init, event}
  end

  defp classify("system", event) do
    {:system, event}
  end

  defp classify("assistant", %{"message" => %{"content" => content}}) when is_binary(content) do
    {:text, content}
  end

  defp classify("assistant", event) do
    {:assistant, event}
  end

  defp classify("content_block_start", event) do
    {:content_block_start, event}
  end

  defp classify("content_block_delta", %{"delta" => %{"text" => text}}) do
    {:text_delta, text}
  end

  defp classify("content_block_delta", event) do
    {:content_block_delta, event}
  end

  defp classify("content_block_stop", event) do
    {:content_block_stop, event}
  end

  defp classify("result", %{"subtype" => "success"} = event) do
    {:result, event}
  end

  defp classify("result", %{"subtype" => "error"} = event) do
    {:error, event}
  end

  defp classify("result", event) do
    {:result, event}
  end

  defp classify(_type, event) do
    {:unknown, event}
  end
end
