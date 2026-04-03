defmodule Ema.Meetings do
  @moduledoc """
  Meetings — schedule and track meetings with attendees.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Meetings.Meeting

  def list_meetings(opts \\ []) do
    query =
      Meeting
      |> order_by(asc: :starts_at)

    query =
      case Keyword.get(opts, :status) do
        nil -> query
        status -> where(query, [m], m.status == ^status)
      end

    query =
      case Keyword.get(opts, :project_id) do
        nil -> query
        pid -> where(query, [m], m.project_id == ^pid)
      end

    Repo.all(query)
  end

  def get_meeting(id), do: Repo.get(Meeting, id)

  def get_meeting!(id), do: Repo.get!(Meeting, id)

  def create_meeting(attrs) do
    id = generate_id("mtg")

    %Meeting{}
    |> Meeting.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_broadcast(:meeting_created)
  end

  def update_meeting(id, attrs) do
    case get_meeting(id) do
      nil -> {:error, :not_found}

      meeting ->
        meeting
        |> Meeting.changeset(attrs)
        |> Repo.update()
        |> tap_broadcast(:meeting_updated)
    end
  end

  def delete_meeting(id) do
    case get_meeting(id) do
      nil -> {:error, :not_found}
      meeting -> Repo.delete(meeting) |> tap_broadcast(:meeting_deleted)
    end
  end

  def upcoming(days \\ 7) do
    now = DateTime.utc_now()
    cutoff = DateTime.add(now, days * 24 * 3600, :second)

    Meeting
    |> where([m], m.starts_at >= ^now and m.starts_at <= ^cutoff)
    |> where([m], m.status == "scheduled")
    |> order_by(asc: :starts_at)
    |> Repo.all()
  end

  defp tap_broadcast(result, event) do
    case result do
      {:ok, record} ->
        Phoenix.PubSub.broadcast(Ema.PubSub, "meetings:updates", {event, record})
        {:ok, record}

      error ->
        error
    end
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
