defmodule EmaWeb.ClipboardController do
  use EmaWeb, :controller

  alias Ema.Clipboard

  action_fallback EmaWeb.FallbackController

  def index(conn, _params) do
    clips = Clipboard.list_clips() |> Enum.map(&serialize/1)
    json(conn, %{clips: clips})
  end

  def show(conn, %{"id" => id}) do
    case Clipboard.get_clip(id) do
      nil -> {:error, :not_found}
      clip -> json(conn, %{clip: serialize(clip)})
    end
  end

  def create(conn, params) do
    attrs = %{
      content: params["content"],
      content_type: params["content_type"] || "text",
      source: params["source"] || "manual",
      pinned: params["pinned"] || false,
      expires_at: parse_datetime(params["expires_at"])
    }

    with {:ok, clip} <- Clipboard.create_clip(attrs) do
      conn
      |> put_status(:created)
      |> json(%{clip: serialize(clip)})
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, _} <- Clipboard.delete_clip(id) do
      json(conn, %{ok: true})
    end
  end

  def pin(conn, %{"id" => id}) do
    with {:ok, clip} <- Clipboard.toggle_pin(id) do
      json(conn, %{clip: serialize(clip)})
    end
  end

  defp serialize(clip) do
    %{
      id: clip.id,
      content: clip.content,
      content_type: clip.content_type,
      source: clip.source,
      pinned: clip.pinned,
      expires_at: clip.expires_at,
      created_at: clip.inserted_at,
      updated_at: clip.updated_at
    }
  end

  defp parse_bool("true"), do: true
  defp parse_bool("false"), do: false
  defp parse_bool(val) when is_boolean(val), do: val
  defp parse_bool(_), do: nil

  defp parse_datetime(nil), do: nil

  defp parse_datetime(dt_string) when is_binary(dt_string) do
    case DateTime.from_iso8601(dt_string) do
      {:ok, dt, _offset} -> dt
      {:error, _} -> nil
    end
  end

  defp parse_datetime(_), do: nil

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, val), do: Keyword.put(opts, key, val)
end
