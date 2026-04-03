defmodule Ema.MCP.Protocol do
  @moduledoc """
  Low-level MCP protocol framing.

  MCP over stdio uses newline-delimited JSON-RPC 2.0.
  Each message is a JSON object followed by a single newline character.

  This module handles:
    - Encoding outbound results and errors
    - Writing framed messages to a Port (stdio)
    - Decoding inbound messages (used by Server)
  """

  require Logger

  @jsonrpc_version "2.0"

  # ── Outbound ──────────────────────────────────────────────────────────────

  @doc """
  Send a successful JSON-RPC result to the client via the given Port.
  """
  def send_result(port, id, result) do
    frame = %{
      "jsonrpc" => @jsonrpc_version,
      "id" => id,
      "result" => result
    }

    write_frame(port, frame)
  end

  @doc """
  Send a JSON-RPC error to the client via the given Port.
  """
  def send_error(port, id, code, message, data \\ nil) do
    error =
      %{
        "code" => code,
        "message" => message
      }
      |> then(fn e -> if data, do: Map.put(e, "data", data), else: e end)

    frame = %{
      "jsonrpc" => @jsonrpc_version,
      "id" => id,
      "error" => error
    }

    write_frame(port, frame)
  end

  @doc """
  Send a JSON-RPC notification (no id, no response expected).
  """
  def send_notification(port, method, params \\ %{}) do
    frame = %{
      "jsonrpc" => @jsonrpc_version,
      "method" => method,
      "params" => params
    }

    write_frame(port, frame)
  end

  # ── Inbound Parsing ───────────────────────────────────────────────────────

  @doc """
  Decode a raw JSON string into a message map.
  Returns {:ok, map} or {:error, reason}.
  """
  def decode(raw) when is_binary(raw) do
    Jason.decode(raw)
  end

  @doc """
  Validate a decoded message has required JSON-RPC fields.
  """
  def validate(%{"jsonrpc" => "2.0", "method" => _} = msg) do
    {:ok, msg}
  end

  def validate(msg) do
    {:error, "Invalid JSON-RPC message: #{inspect(msg)}"}
  end

  # ── Standard Error Codes ─────────────────────────────────────────────────

  @doc "Standard JSON-RPC parse error"
  def parse_error, do: -32700

  @doc "Invalid JSON-RPC request structure"
  def invalid_request, do: -32600

  @doc "Method not found"
  def method_not_found, do: -32601

  @doc "Invalid parameters"
  def invalid_params, do: -32602

  @doc "Internal error"
  def internal_error, do: -32603

  # ── Private ───────────────────────────────────────────────────────────────

  defp write_frame(port, frame) do
    case Jason.encode(frame) do
      {:ok, json} ->
        Port.command(port, json <> "\n")

      {:error, reason} ->
        Logger.error("[MCP Protocol] Failed to encode frame: #{inspect(reason)}")
        :error
    end
  end
end
