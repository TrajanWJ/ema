defmodule EmaWeb.IntentsController do
  use EmaWeb, :controller

  alias Ema.Intents

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_add(:project_id, params["project_id"])
      |> maybe_add(:level, parse_int(params["level"]))
      |> maybe_add(:status, params["status"])
      |> maybe_add(:kind, params["kind"])
      |> maybe_add(:search, params["search"])
      |> maybe_add(:limit, parse_int(params["limit"]))

    intents = Intents.list_intents(opts) |> Enum.map(&Intents.serialize/1)
    json(conn, %{intents: intents})
  end

  def show(conn, %{"id" => id}) do
    case Intents.get_intent_detail(id) do
      nil ->
        {:error, :not_found}

      detail ->
        json(conn, detail)
    end
  end

  def create(conn, params) do
    attrs = %{
      title: params["title"],
      slug: params["slug"],
      description: params["description"],
      level: parse_int(params["level"]) || 4,
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
    root_id = params["root_id"] || params["id"]
    max_depth = parse_int(params["max_depth"]) || 10

    cond do
      root_id && root_id != "" ->
        case Intents.tree_from(root_id, max_depth) do
          nil ->
            {:error, :not_found}

          subtree ->
            json(conn, %{tree: [Intents.serialize_tree(subtree)]})
        end

      true ->
        opts = maybe_add([], :project_id, params["project_id"])

        tree =
          opts
          |> Intents.tree()
          |> Enum.map(&Intents.serialize_tree/1)

        json(conn, %{tree: tree})
    end
  end

  def ancestors(conn, %{"id" => id}) do
    case Intents.get_intent(id) do
      nil ->
        {:error, :not_found}

      _intent ->
        ancestors = Intents.ancestors(id) |> Enum.map(&Intents.serialize/1)
        json(conn, %{ancestors: ancestors})
    end
  end

  def descendants(conn, %{"id" => id} = params) do
    max_depth = parse_int(params["max_depth"]) || 10

    case Intents.get_intent(id) do
      nil ->
        {:error, :not_found}

      _intent ->
        descendants = Intents.descendants(id, max_depth) |> Enum.map(&Intents.serialize/1)
        json(conn, %{descendants: descendants})
    end
  end

  def path(conn, %{"id" => id}) do
    case Intents.get_intent(id) do
      nil ->
        {:error, :not_found}

      _intent ->
        path = Intents.lineage_path(id) |> Enum.map(&Intents.serialize/1)
        json(conn, %{path: path})
    end
  end

  def orphans(conn, _params) do
    orphans = Intents.orphans() |> Enum.map(&Intents.serialize/1)
    json(conn, %{orphans: orphans})
  end

  def set_parent(conn, %{"id" => id, "parent_id" => parent_id}) do
    case Intents.set_parent(id, parent_id) do
      {:ok, intent} -> json(conn, Intents.serialize(intent))
      {:error, :not_found} -> {:error, :not_found}
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def clear_parent(conn, %{"id" => id}) do
    case Intents.clear_parent(id) do
      {:ok, intent} -> json(conn, Intents.serialize(intent))
      {:error, :not_found} -> {:error, :not_found}
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def status(conn, params) do
    opts =
      []
      |> maybe_add(:project_id, params["project_id"])

    json(conn, Intents.status_summary(opts))
  end

  def lineage(conn, %{"id" => id}) do
    case Intents.get_intent(id) do
      nil ->
        {:error, :not_found}

      _intent ->
        events = Intents.get_lineage(id) |> Enum.map(&Intents.serialize_event/1)
        json(conn, %{events: events})
    end
  end

  def runtime(conn, %{"id" => id}) do
    case Intents.get_runtime_bundle(id) do
      nil ->
        {:error, :not_found}

      bundle ->
        json(conn, bundle)
    end
  end

  def attach_actor(conn, %{"id" => id, "actor_id" => actor_id} = params) do
    case Intents.attach_actor(id, actor_id,
           role: params["role"] || "assignee",
           provenance: params["provenance"] || "manual"
         ) do
      {:ok, link} ->
        conn
        |> put_status(:created)
        |> json(Intents.serialize_link(link))

      {:error, :not_found} ->
        {:error, :not_found}

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: inspect(reason)})
    end
  end

  def attach_execution(conn, %{"id" => id, "execution_id" => execution_id} = params) do
    case Intents.attach_execution(id, execution_id,
           role: params["role"] || "runtime",
           provenance: params["provenance"] || "execution"
         ) do
      {:ok, link} ->
        conn
        |> put_status(:created)
        |> json(Intents.serialize_link(link))

      {:error, :not_found} ->
        {:error, :not_found}

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: inspect(reason)})
    end
  end

  def attach_session(conn, %{"id" => id, "session_id" => session_id} = params) do
    case Intents.attach_session(id, params["session_type"] || "claude_session", session_id,
           role: params["role"] || "runtime",
           provenance: params["provenance"]
         ) do
      {:ok, link} ->
        conn
        |> put_status(:created)
        |> json(Intents.serialize_link(link))

      {:error, :not_found} ->
        {:error, :not_found}

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: inspect(reason)})
    end
  end

  def create_link(conn, %{"id" => id} = params) do
    case Intents.get_intent(id) do
      nil ->
        {:error, :not_found}

      _intent ->
        linkable_type = params["linkable_type"] || params["type"] || "execution"
        linkable_id = params["linkable_id"] || params["target_id"]
        role = params["role"] || "related"
        provenance = params["provenance"] || "manual"

        case Intents.link_intent(id, linkable_type, linkable_id,
               role: role,
               provenance: provenance
             ) do
          {:ok, link} ->
            conn
            |> put_status(:created)
            |> json(Intents.serialize_link(link))

          {:error, changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{errors: format_errors(changeset)})
        end
    end
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
