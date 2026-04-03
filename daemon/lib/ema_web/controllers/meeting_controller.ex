defmodule EmaWeb.MeetingController do
  use EmaWeb, :controller

  alias Ema.Meetings

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_add(:status, params["status"])
      |> maybe_add(:project_id, params["project_id"])

    meetings = Meetings.list_meetings(opts) |> Enum.map(&serialize/1)
    json(conn, %{meetings: meetings})
  end

  def show(conn, %{"id" => id}) do
    case Meetings.get_meeting(id) do
      nil -> {:error, :not_found}
      meeting -> json(conn, %{meeting: serialize(meeting)})
    end
  end

  def create(conn, params) do
    attrs = %{
      title: params["title"],
      description: params["description"],
      starts_at: parse_datetime(params["starts_at"]),
      ends_at: parse_datetime(params["ends_at"]),
      attendees: params["attendees"] || %{},
      location: params["location"],
      project_id: params["project_id"],
      notes: params["notes"],
      status: params["status"] || "scheduled"
    }

    with {:ok, meeting} <- Meetings.create_meeting(attrs) do
      conn
      |> put_status(:created)
      |> json(%{meeting: serialize(meeting)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    attrs =
      %{}
      |> maybe_put(:title, params["title"])
      |> maybe_put(:description, params["description"])
      |> maybe_put(:starts_at, parse_datetime(params["starts_at"]))
      |> maybe_put(:ends_at, parse_datetime(params["ends_at"]))
      |> maybe_put(:attendees, params["attendees"])
      |> maybe_put(:location, params["location"])
      |> maybe_put(:project_id, params["project_id"])
      |> maybe_put(:notes, params["notes"])
      |> maybe_put(:status, params["status"])

    with {:ok, meeting} <- Meetings.update_meeting(id, attrs) do
      json(conn, %{meeting: serialize(meeting)})
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, _} <- Meetings.delete_meeting(id) do
      json(conn, %{ok: true})
    end
  end

  def upcoming(conn, _params) do
    meetings = Meetings.upcoming() |> Enum.map(&serialize/1)
    json(conn, %{meetings: meetings})
  end

  defp serialize(meeting) do
    %{
      id: meeting.id,
      title: meeting.title,
      description: meeting.description,
      starts_at: meeting.starts_at,
      ends_at: meeting.ends_at,
      attendees: meeting.attendees,
      location: meeting.location,
      project_id: meeting.project_id,
      notes: meeting.notes,
      status: meeting.status,
      created_at: meeting.inserted_at,
      updated_at: meeting.updated_at
    }
  end

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

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, val), do: Map.put(map, key, val)
end
