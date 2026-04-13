defmodule EmaWeb.RoutineController do
  use EmaWeb, :controller

  alias Ema.Routines

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_add(:active, parse_bool(params["active"]))

    routines = Routines.list_routines(opts) |> Enum.map(&serialize/1)
    json(conn, %{routines: routines})
  end

  def show(conn, %{"id" => id}) do
    case Routines.get_routine(id) do
      nil -> {:error, :not_found}
      routine -> json(conn, %{routine: serialize(routine)})
    end
  end

  def create(conn, params) do
    attrs = %{
      name: params["name"],
      description: params["description"],
      steps: params["steps"] || %{},
      cadence: params["cadence"] || "daily",
      active: params["active"] != false
    }

    with {:ok, routine} <- Routines.create_routine(attrs) do
      conn
      |> put_status(:created)
      |> json(%{routine: serialize(routine)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    attrs =
      %{}
      |> maybe_put(:name, params["name"])
      |> maybe_put(:description, params["description"])
      |> maybe_put(:steps, params["steps"])
      |> maybe_put(:cadence, params["cadence"])
      |> maybe_put(:active, params["active"])

    with {:ok, routine} <- Routines.update_routine(id, attrs) do
      json(conn, %{routine: serialize(routine)})
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, _} <- Routines.delete_routine(id) do
      json(conn, %{ok: true})
    end
  end

  def toggle(conn, %{"id" => id}) do
    with {:ok, routine} <- Routines.toggle(id) do
      json(conn, %{routine: serialize(routine)})
    end
  end

  def run(conn, %{"id" => id}) do
    with {:ok, routine} <- Routines.mark_run(id) do
      json(conn, %{routine: serialize(routine)})
    end
  end

  defp serialize(routine) do
    %{
      id: routine.id,
      name: routine.name,
      description: routine.description,
      steps: routine.steps,
      cadence: routine.cadence,
      active: routine.active,
      last_run_at: routine.last_run_at,
      created_at: routine.inserted_at,
      updated_at: routine.updated_at
    }
  end

  defp parse_bool("true"), do: true
  defp parse_bool("false"), do: false
  defp parse_bool(val) when is_boolean(val), do: val
  defp parse_bool(_), do: nil

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, val), do: Keyword.put(opts, key, val)

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, val), do: Map.put(map, key, val)
end
