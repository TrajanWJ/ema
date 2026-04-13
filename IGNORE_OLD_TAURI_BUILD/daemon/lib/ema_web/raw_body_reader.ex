defmodule EmaWeb.RawBodyReader do
  @moduledoc false

  alias Plug.Conn

  def read(conn, opts) do
    read_body(conn, opts, "")
  end

  defp read_body(conn, opts, acc) do
    case Conn.read_body(conn, opts) do
      {:ok, chunk, conn} ->
        full = acc <> chunk
        {Conn.put_private(conn, :raw_body, full), full}

      {:more, chunk, conn} ->
        read_body(conn, opts, acc <> chunk)

      {:error, _reason} ->
        {conn, acc}
    end
  end
end
