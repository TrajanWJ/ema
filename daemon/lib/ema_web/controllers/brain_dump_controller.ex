defmodule EmaWeb.BrainDumpController do
  use EmaWeb, :controller

  alias Ema.BrainDump

  action_fallback EmaWeb.FallbackController

  def index(conn, _params) do
    items = BrainDump.list_items() |> Enum.map(&serialize_item/1)
    json(conn, %{items: items})
  end

  def create(conn, params) do
    attrs = %{
      content: params["content"],
      source: params["source"] || "text"
    }

    with {:ok, item} <- BrainDump.create_item(attrs) do
      EmaWeb.Endpoint.broadcast("brain_dump:queue", "item_created", serialize_item(item))

      conn
      |> put_status(:created)
      |> json(serialize_item(item))
    end
  end

  def process(conn, %{"id" => id} = params) do
    action = params["action"]

    with {:ok, item} <- BrainDump.process_item(id, action) do
      EmaWeb.Endpoint.broadcast("brain_dump:queue", "item_processed", serialize_item(item))
      json(conn, serialize_item(item))
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, item} <- BrainDump.delete_item(id) do
      EmaWeb.Endpoint.broadcast("brain_dump:queue", "item_deleted", %{id: item.id})
      json(conn, %{ok: true})
    end
  end

  defp serialize_item(item) do
    %{
      id: item.id,
      content: item.content,
      source: item.source,
      processed: item.processed,
      action: item.action,
      processed_at: item.processed_at,
      created_at: item.inserted_at,
      updated_at: item.updated_at
    }
  end
end
