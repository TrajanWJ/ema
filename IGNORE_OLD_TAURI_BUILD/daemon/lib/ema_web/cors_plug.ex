defmodule EmaWeb.CORSPlug do
  @moduledoc false
  import Plug.Conn

  alias EmaWeb.AccessControl

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
    allowed_origin = allowed_origin(origin)

    if is_nil(allowed_origin) do
      conn
    else
      conn
        |> put_resp_header("access-control-allow-origin", allowed_origin)
        |> put_resp_header("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        |> put_resp_header("access-control-allow-headers", "content-type, authorization")
        |> put_resp_header("access-control-max-age", "86400")
        |> put_resp_header("access-control-allow-credentials", "true")
        |> put_resp_header("vary", "Origin")
    end
  end

  defp allowed_origin(origin) do
    if origin in AccessControl.allowed_origins(), do: origin, else: nil
  end
end
