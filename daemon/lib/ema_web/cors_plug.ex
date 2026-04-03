defmodule EmaWeb.CORSPlug do
  @moduledoc false
  import Plug.Conn

  @allowed_origins ["http://localhost:1420", "http://tauri.localhost", "tauri://localhost"]

  def init(opts), do: opts

  def call(%Plug.Conn{method: "OPTIONS"} = conn, _opts) do
    conn
    |> put_cors_headers()
    |> send_resp(204, "")
    |> halt()
  end

  def call(conn, _opts) do
    put_cors_headers(conn)
  end

  defp put_cors_headers(conn) do
    origin = get_req_header(conn, "origin") |> List.first() || ""

    allowed_origin =
      if origin in @allowed_origins, do: origin, else: hd(@allowed_origins)

    conn
    |> put_resp_header("access-control-allow-origin", allowed_origin)
    |> put_resp_header("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    |> put_resp_header("access-control-allow-headers", "content-type, authorization")
    |> put_resp_header("access-control-max-age", "86400")
  end
end
