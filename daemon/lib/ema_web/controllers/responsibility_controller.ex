defmodule EmaWeb.ResponsibilityController do
  use EmaWeb, :controller

  alias Ema.Responsibilities

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_add_opt(:project_id, params["project_id"])
      |> maybe_add_opt(:role, params["role"])
      |> maybe_add_opt(:active, parse_bool(params["active"]))

    responsibilities =
      Responsibilities.list_responsibilities(opts)
      |> Enum.map(&serialize/1)

    json(conn, %{responsibilities: responsibilities})
  end

  def show(conn, %{"id" => id}) do
    case Responsibilities.get_responsibility(id) do
      nil -> {:error, :not_found}
      resp -> json(conn, serialize(resp))
    end
  end

  def create(conn, params) do
    attrs = %{
      title: params["title"],
      description: params["description"],
      role: params["role"],
      cadence: params["cadence"],
      recurrence_rule: params["recurrence_rule"],
      metadata: params["metadata"],
      project_id: params["project_id"]
    }

    with {:ok, resp} <- Responsibilities.create_responsibility(attrs) do
      broadcast("responsibility_created", serialize(resp))

      conn
      |> put_status(:created)
      |> json(serialize(resp))
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Responsibilities.get_responsibility(id) do
      nil ->
        {:error, :not_found}

      resp ->
        attrs =
          %{
            title: params["title"],
            description: params["description"],
            role: params["role"],
            cadence: params["cadence"],
            recurrence_rule: params["recurrence_rule"],
            metadata: params["metadata"],
            project_id: params["project_id"]
          }
          |> Enum.reject(fn {_k, v} -> is_nil(v) end)
          |> Map.new()

        with {:ok, updated} <- Responsibilities.update_responsibility(resp, attrs) do
          broadcast("responsibility_updated", serialize(updated))
          json(conn, serialize(updated))
        end
    end
  end

  def delete(conn, %{"id" => id}) do
    case Responsibilities.get_responsibility(id) do
      nil ->
        {:error, :not_found}

      resp ->
        with {:ok, _} <- Responsibilities.delete_responsibility(resp) do
          broadcast("responsibility_deleted", %{id: id})
          json(conn, %{ok: true})
        end
    end
  end

  def check_in(conn, %{"id" => id} = params) do
    case Responsibilities.get_responsibility(id) do
      nil ->
        {:error, :not_found}

      resp ->
        attrs = %{
          status: params["status"],
          note: params["note"]
        }

        with {:ok, {updated_resp, check_in}} <- Responsibilities.check_in(resp, attrs) do
          broadcast("check_in_created", %{
            responsibility: serialize(updated_resp),
            check_in: serialize_check_in(check_in)
          })

          conn
          |> put_status(:created)
          |> json(%{
            responsibility: serialize(updated_resp),
            check_in: serialize_check_in(check_in)
          })
        end
    end
  end

  def at_risk(conn, _params) do
    responsibilities =
      Responsibilities.list_at_risk()
      |> Enum.map(&serialize/1)

    json(conn, %{responsibilities: responsibilities})
  end

  defp broadcast(event, payload) do
    EmaWeb.Endpoint.broadcast("responsibilities:lobby", event, payload)
  end

  defp serialize(resp) do
    %{
      id: resp.id,
      title: resp.title,
      description: resp.description,
      role: resp.role,
      cadence: resp.cadence,
      health: resp.health,
      active: resp.active,
      last_checked_at: resp.last_checked_at,
      recurrence_rule: resp.recurrence_rule,
      metadata: resp.metadata,
      project_id: resp.project_id,
      created_at: resp.inserted_at,
      updated_at: resp.updated_at
    }
  end

  defp serialize_check_in(check_in) do
    %{
      id: check_in.id,
      status: check_in.status,
      note: check_in.note,
      responsibility_id: check_in.responsibility_id,
      created_at: check_in.inserted_at,
      updated_at: check_in.updated_at
    }
  end

  defp maybe_add_opt(opts, _key, nil), do: opts
  defp maybe_add_opt(opts, key, value), do: Keyword.put(opts, key, value)

  defp parse_bool("true"), do: true
  defp parse_bool("false"), do: false
  defp parse_bool(_), do: nil
end
