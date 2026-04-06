defmodule EmaWeb.IntentsController do
  use EmaWeb, :controller

  alias Ema.Intents
  alias Ema.Intents.IntentEvent

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_add(:project_id, params["project_id"])
      |> maybe_add(:level, parse_int(params["level"]))
      |> maybe_add(:status, params["status"])
      |> maybe_add(:kind, params["kind"])
      |> maybe_add(:limit, parse_int(params["limit"]))

    intents = Intents.list_intents(opts) |> Enum.map(&Intents.serialize/1)
    json(conn, %{intents: intents})
  end

  def show(conn, %{"id" => id}) do
    case Intents.get_intent(id) do
      nil ->
        {:error, :not_found}

      intent ->
        links = Intents.get_links(intent.id) |> Enum.map(&serialize_link/1)
        lineage = Intents.get_lineage(intent.id, limit: 20) |> Enum.map(&serialize_event/1)

        json(conn, %{
          intent: Intents.serialize(intent),
          links: links,
          lineage: lineage
        })
    end
  end

  def create(conn, params) do
    attrs = %{
      title: params["title"],
      slug: params["slug"],
      description: params["description"],
      level: params["level"] || 4,
      kind: params["kind"] || "task",
      parent_id: params["parent_id"],
      project_id: params["project_id"],
      source_type: params["source_type"] || "manual",
      status: params["status"] || "planned",
      priority: params["priority"],
      tags: encode_json(params["tags"]),
      metadata: encode_json(params["metadata"])
    }

    case Intents.create_intent(attrs) do
      {:ok, intent} ->
        conn
        |> put_status(:created)
        |> json(Intents.serialize(intent))

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Intents.get_intent(id) do
      nil ->
        {:error, :not_found}

      intent ->
        attrs =
          %{}
          |> maybe_put(:title, params["title"])
          |> maybe_put(:slug, params["slug"])
          |> maybe_put(:description, params["description"])
          |> maybe_put(:level, params["level"])
          |> maybe_put(:kind, params["kind"])
          |> maybe_put(:parent_id, params["parent_id"])
          |> maybe_put(:project_id, params["project_id"])
          |> maybe_put(:source_type, params["source_type"])
          |> maybe_put(:status, params["status"])
          |> maybe_put(:phase, params["phase"])
          |> maybe_put(:priority, params["priority"])
          |> maybe_put(:tags, encode_json(params["tags"]))
          |> maybe_put(:metadata, encode_json(params["metadata"]))

        with {:ok, updated} <- Intents.update_intent(intent, attrs) do
          json(conn, Intents.serialize(updated))
        end
    end
  end

  def delete(conn, %{"id" => id}) do
    case Intents.get_intent(id) do
      nil ->
        {:error, :not_found}

      intent ->
        with {:ok, _} <- Intents.delete_intent(intent) do
          json(conn, %{ok: true})
        end
    end
  end

  def tree(conn, params) do
    opts =
      []
      |> maybe_add(:project_id, params["project_id"] || params["id"])

    tree = Intents.tree(opts) |> Enum.map(&serialize_tree_node/1)
    json(conn, %{tree: tree})
  end

  def lineage(conn, %{"id" => id}) do
    case Intents.get_intent(id) do
      nil ->
        {:error, :not_found}

      _intent ->
        events = Intents.get_lineage(id) |> Enum.map(&serialize_event/1)
        json(conn, %{events: events})
    end
  end

  # ── Serializers ──────────────────────────────────────────────────

  defp serialize_link(link) do
    %{
      id: link.id,
      intent_id: link.intent_id,
      linkable_type: link.linkable_type,
      linkable_id: link.linkable_id,
      role: link.role,
      provenance: link.provenance,
      inserted_at: link.inserted_at
    }
  end

  defp serialize_event(%IntentEvent{} = event) do
    %{
      id: event.id,
      intent_id: event.intent_id,
      event_type: event.event_type,
      payload: IntentEvent.decode_payload(event),
      actor: event.actor,
      inserted_at: event.inserted_at
    }
  end

  defp serialize_tree_node(node) do
    children = Map.get(node, :children, [])

    Intents.serialize(node)
    |> Map.put(:children, Enum.map(children, &serialize_tree_node/1))
  end

  # ── Helpers ──────────────────────────────────────────────────────

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, val), do: Keyword.put(opts, key, val)

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, val), do: Map.put(map, key, val)

  defp parse_int(nil), do: nil
  defp parse_int(val) when is_integer(val), do: val

  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      :error -> nil
    end
  end

  defp encode_json(nil), do: nil
  defp encode_json(val) when is_binary(val), do: val
  defp encode_json(val), do: Jason.encode!(val)

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
