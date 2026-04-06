defmodule EmaWeb.TagController do
  use EmaWeb, :controller

  alias Ema.Actors

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    tags =
      Actors.list_tags(
        entity_type: params["entity_type"],
        entity_id: params["entity_id"],
        actor_id: params["actor_id"]
      )

    json(conn, %{tags: Enum.map(tags, &serialize/1)})
  end

  def create(conn, params) do
    with {:ok, tag} <-
           Actors.tag_entity(
             params["entity_type"],
             params["entity_id"],
             params["tag"],
             params["actor_id"] || "human",
             params["namespace"] || "default"
           ) do
      conn
      |> put_status(:created)
      |> json(%{tag: serialize(tag)})
    end
  end

  def delete(conn, params) do
    {count, _} =
      Actors.untag_entity(
        params["entity_type"],
        params["entity_id"],
        params["tag"],
        params["actor_id"] || "human"
      )

    json(conn, %{deleted: count})
  end

  defp serialize(tag) do
    %{
      id: tag.id,
      entity_type: tag.entity_type,
      entity_id: tag.entity_id,
      tag: tag.tag,
      actor_id: tag.actor_id,
      namespace: tag.namespace,
      inserted_at: tag.inserted_at,
      updated_at: tag.updated_at
    }
  end
end
