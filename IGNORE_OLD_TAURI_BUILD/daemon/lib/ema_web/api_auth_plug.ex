defmodule EmaWeb.APIAuthPlug do
  @moduledoc false

  import Plug.Conn

  alias EmaWeb.AccessControl

  def init(opts), do: opts

  def call(conn, _opts) do
    if public_api_path?(conn.path_info) do
      conn
    else
      cond do
        AccessControl.local_request?(conn) ->
          conn

        (token = extract_token(conn)) && AccessControl.token_allowed?(token) ->
          conn

        true ->
          unauthorized(conn)
      end
    end
  end

  defp public_api_path?(["api", "health"]), do: true
  defp public_api_path?(["api", "status"]), do: true
  defp public_api_path?(["api", "webhooks" | _rest]), do: true
  defp public_api_path?(["api", "join", _token | _rest]), do: true
  defp public_api_path?(_), do: false

  defp extract_token(conn) do
    conn
    |> get_req_header("authorization")
    |> Enum.find_value(&parse_bearer/1)
    |> fallback_query(conn)
  end

  defp parse_bearer("Bearer " <> token), do: String.trim(token)
  defp parse_bearer("bearer " <> token), do: String.trim(token)
  defp parse_bearer(_), do: nil

  defp fallback_query(nil, conn) do
    conn = fetch_query_params(conn)
    conn.query_params["api_token"] || conn.query_params["token"]
  end

  defp fallback_query(token, _conn), do: token

  defp unauthorized(conn) do
    body = Jason.encode!(%{error: "unauthorized"})

    conn
    |> put_status(:unauthorized)
    |> put_resp_header("content-type", "application/json")
    |> send_resp(401, body)
    |> halt()
  end
end
