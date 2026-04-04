defmodule Ema.OpenClaw.GatewayRPC do
  @moduledoc """
  Minimal WebSocket JSON-RPC client for the OpenClaw gateway.

  Opens a raw TCP connection, performs an HTTP upgrade handshake, sends a
  single JSON-RPC request, reads the response frame, and closes the socket.

  Uses only stdlib — no extra WebSocket library needed.

  ## RPC format (JSONL socket protocol)
    Request:  {"id": 1, "method": "sessions.list", "params": {...}}
    Response: {"id": 1, "ok": true, "result": {...}}  OR
              {"id": 1, "ok": false, "error": {...}}
  """

  require Logger

  @connect_timeout 5_000
  @recv_timeout 15_000

  @doc """
  Call a gateway RPC method. Returns {:ok, result} or {:error, reason}.
  """
  def call(method, params \\ %{}) do
    uri = URI.parse(gateway_url())
    host = String.to_charlist(uri.host || "localhost")
    port = uri.port || 80

    with {:ok, sock} <- :gen_tcp.connect(host, port, [:binary, active: false], @connect_timeout),
         :ok <- send_upgrade(sock, host, port),
         {:ok, _headers} <- recv_upgrade(sock),
         :ok <- send_rpc(sock, method, params),
         {:ok, payload} <- recv_frame(sock) do
      :gen_tcp.close(sock)

      case Jason.decode(payload) do
        {:ok, %{"ok" => true, "result" => result}} ->
          {:ok, result}

        {:ok, %{"ok" => false, "error" => error}} ->
          {:error, {:rpc_error, error}}

        {:ok, other} ->
          {:error, {:unexpected_response, other}}

        {:error, reason} ->
          {:error, {:json_decode, reason}}
      end
    else
      {:error, reason} ->
        {:error, reason}
    end
  rescue
    e -> {:error, {:exception, Exception.message(e)}}
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp gateway_url do
    Application.get_env(:ema, :openclaw, [])
    |> Keyword.get(:gateway_url, "http://localhost:18789")
  end

  defp send_upgrade(sock, host, port) do
    key = Base.encode64(:crypto.strong_rand_bytes(16))
    host_header = if port in [80, 443], do: host, else: "#{host}:#{port}"

    request =
      "GET /ws HTTP/1.1\r\n" <>
        "Host: #{host_header}\r\n" <>
        "Upgrade: websocket\r\n" <>
        "Connection: Upgrade\r\n" <>
        "Sec-WebSocket-Key: #{key}\r\n" <>
        "Sec-WebSocket-Version: 13\r\n" <>
        "\r\n"

    :gen_tcp.send(sock, request)
  end

  defp recv_upgrade(sock) do
    # Read until we see end-of-headers
    recv_until_headers_end(sock, "")
  end

  defp recv_until_headers_end(sock, acc) do
    case :gen_tcp.recv(sock, 0, @recv_timeout) do
      {:ok, data} ->
        combined = acc <> data

        if String.contains?(combined, "\r\n\r\n") do
          [headers | _] = String.split(combined, "\r\n\r\n", parts: 2)

          if String.contains?(headers, "101") do
            {:ok, headers}
          else
            {:error, {:upgrade_failed, String.slice(headers, 0, 200)}}
          end
        else
          recv_until_headers_end(sock, combined)
        end

      {:error, reason} ->
        {:error, {:recv_upgrade, reason}}
    end
  end

  defp send_rpc(sock, method, params) do
    payload =
      Jason.encode!(%{
        id: 1,
        method: method,
        params: params
      })

    frame = encode_ws_frame(payload)
    :gen_tcp.send(sock, frame)
  end

  # Encode a text WebSocket frame with masking (required for client→server)
  defp encode_ws_frame(payload) do
    bytes = :binary.bin_to_list(payload)
    len = length(bytes)
    mask_key = :crypto.strong_rand_bytes(4)
    <<m0, m1, m2, m3>> = mask_key

    masked =
      bytes
      |> Enum.with_index()
      |> Enum.map(fn {byte, i} ->
        mask_byte = Enum.at([m0, m1, m2, m3], rem(i, 4))
        Bitwise.bxor(byte, mask_byte)
      end)
      |> :binary.list_to_bin()

    header =
      cond do
        len <= 125 ->
          <<0x81, Bitwise.bor(len, 0x80), mask_key::binary>>

        len <= 65_535 ->
          <<0x81, Bitwise.bor(126, 0x80), len::16, mask_key::binary>>

        true ->
          <<0x81, Bitwise.bor(127, 0x80), len::64, mask_key::binary>>
      end

    header <> masked
  end

  # Read one complete WebSocket frame from the server
  defp recv_frame(sock) do
    recv_frame(sock, "")
  end

  defp recv_frame(sock, acc) do
    case :gen_tcp.recv(sock, 0, @recv_timeout) do
      {:ok, data} ->
        combined = acc <> data
        parse_ws_frame(sock, combined)

      {:error, reason} ->
        {:error, {:recv_frame, reason}}
    end
  end

  defp parse_ws_frame(sock, data) when byte_size(data) < 2 do
    recv_frame(sock, data)
  end

  defp parse_ws_frame(sock, <<_fin_opcode, second_byte, rest::binary>> = data) do
    masked = Bitwise.band(second_byte, 0x80) != 0
    raw_len = Bitwise.band(second_byte, 0x7F)

    case parse_length_and_payload(raw_len, masked, rest) do
      {:need_more, _} ->
        recv_frame(sock, data)

      {:ok, payload} ->
        {:ok, payload}

      _ ->
        {:error, :parse_error}
    end
  end

  defp parse_length_and_payload(raw_len, masked, rest) do
    case {raw_len, byte_size(rest)} do
      {_, n} when n < 0 ->
        {:need_more, nil}

      {len, _} when len <= 125 ->
        extract_payload(rest, len, masked)

      {126, n} when n < 2 ->
        {:need_more, nil}

      {126, _} ->
        <<ext_len::16, after_len::binary>> = rest
        extract_payload(after_len, ext_len, masked)

      {127, n} when n < 8 ->
        {:need_more, nil}

      {127, _} ->
        <<ext_len::64, after_len::binary>> = rest
        extract_payload(after_len, ext_len, masked)
    end
  end

  defp extract_payload(data, len, masked) do
    mask_bytes = if masked, do: 4, else: 0

    if byte_size(data) < mask_bytes + len do
      {:need_more, nil}
    else
      if masked do
        <<mask_key::binary-size(4), payload_raw::binary-size(len), _::binary>> = data
        {:ok, unmask(payload_raw, mask_key)}
      else
        <<payload::binary-size(len), _::binary>> = data
        {:ok, payload}
      end
    end
  end

  defp unmask(payload, <<m0, m1, m2, m3>>) do
    mask = [m0, m1, m2, m3]

    payload
    |> :binary.bin_to_list()
    |> Enum.with_index()
    |> Enum.map(fn {byte, i} -> Bitwise.bxor(byte, Enum.at(mask, rem(i, 4))) end)
    |> :binary.list_to_bin()
  end
end
