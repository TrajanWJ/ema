defmodule EmaWeb.SpaceController do
  @moduledoc """
  Phoenix controller for Space CRUD operations.

  Endpoints:
    GET  /api/spaces         → index/2   (list all spaces + orgs)
    POST /api/spaces         → create/2  (create a new space)
    GET  /api/spaces/:id     → show/2    (fetch a single space)
  """

  use EmaWeb, :controller

  alias Ema.Repo
  alias Ema.Spaces.Space
  import Ecto.Query

  # ── index/2 ─────────────────────────────────────────────────────────────────

  @doc """
  List all spaces joined with their org data.

  Response shape:
      {
        "spaces": [
          {
            "id": "...",
            "name": "...",
            "space_type": "personal"|"team"|"project",
            "org_id": "...",
            "icon": "..." | null,
            "color": "..." | null
          }
        ],
        "orgs": [
          { "id": "...", "name": "..." }
        ]
      }
  """
  def index(conn, _params) do
    spaces =
      from(s in Space,
        order_by: [asc: s.space_type, asc: s.name]
      )
      |> Repo.all()
      |> Enum.map(&serialize_space/1)

    # TODO: Ema.Orgs.Org module not yet implemented — org fetching deferred
    json(conn, %{spaces: spaces, orgs: []})
  end

  # ── create/2 ────────────────────────────────────────────────────────────────

  @doc """
  Create a new space.

  Expected params:
    - org_id     (string, required)
    - name       (string, required)
    - space_type (string: "personal" | "team" | "project", required)
    - icon       (string emoji, optional)
    - color      (hex color string, optional)

  Returns the created space or error details.
  """
  def create(conn, params) do
    attrs = %{
      org_id: params["org_id"],
      name: params["name"],
      space_type: params["space_type"],
      icon: params["icon"],
      color: params["color"]
    }

    changeset = Space.changeset(%Space{}, attrs)

    case Repo.insert(changeset) do
      {:ok, space} ->
        conn
        |> put_status(:created)
        |> json(%{space: serialize_space(space)})

      {:error, changeset} ->
        errors = format_changeset_errors(changeset)

        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "Validation failed", details: errors})
    end
  end

  # ── show/2 ──────────────────────────────────────────────────────────────────

  @doc """
  Fetch a single space by ID.

  Returns the space object or 404.
  """
  def show(conn, %{"id" => id}) do
    case Repo.get(Space, id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Space not found"})

      space ->
        json(conn, %{space: serialize_space(space)})
    end
  end

  # ── Private helpers ──────────────────────────────────────────────────────────

  defp serialize_space(%Space{} = space) do
    %{
      "id" => space.id,
      "name" => space.name,
      "space_type" => to_string(space.space_type),
      "org_id" => space.org_id,
      "icon" => space.icon,
      "color" => space.color
    }
  end

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
