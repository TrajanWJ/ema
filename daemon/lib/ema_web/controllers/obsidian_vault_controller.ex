defmodule EmaWeb.ObsidianVaultController do
  use EmaWeb, :controller

  alias Ema.Vault.VaultIndex

  action_fallback EmaWeb.FallbackController

  # GET /api/obsidian/notes?limit=20
  def index(conn, params) do
    limit = Map.get(params, "limit", "20") |> parse_int(20)
    notes = VaultIndex.list_recent(limit)
    json(conn, %{notes: notes})
  end

  # GET /api/obsidian/search?q=query
  def search(conn, %{"q" => query}) when query != "" do
    notes = VaultIndex.search(query)
    json(conn, %{notes: notes, query: query})
  end

  def search(conn, _params) do
    json(conn, %{notes: [], query: ""})
  end

  # GET /api/obsidian/notes/*path
  def show(conn, %{"path" => path_parts}) do
    path = Enum.join(List.wrap(path_parts), "/")

    case VaultIndex.get_note(path) do
      {:ok, note} ->
        json(conn, %{note: note})

      {:error, :enoent} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Note not found: #{path}"})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: inspect(reason)})
    end
  end

  # POST /api/obsidian/notes
  def create(conn, %{"path" => path, "content" => content}) do
    case VaultIndex.write_note(path, content) do
      :ok ->
        conn
        |> put_status(:created)
        |> json(%{ok: true, path: path})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: inspect(reason)})
    end
  end

  def create(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "path and content are required"})
  end

  defp parse_int(val, default) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      _ -> default
    end
  end
  defp parse_int(val, _) when is_integer(val), do: val
  defp parse_int(_, default), do: default
end
