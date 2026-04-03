defmodule Ema.Routines do
  @moduledoc """
  Routine Builder — create and manage daily/weekly routines with steps.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Routines.Routine

  def list_routines(opts \\ []) do
    query =
      Routine
      |> order_by(asc: :name)

    query =
      case Keyword.get(opts, :active) do
        nil -> query
        active -> where(query, [r], r.active == ^active)
      end

    Repo.all(query)
  end

  def get_routine(id), do: Repo.get(Routine, id)

  def get_routine!(id), do: Repo.get!(Routine, id)

  def create_routine(attrs) do
    id = generate_id("rtn")

    %Routine{}
    |> Routine.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_broadcast(:routine_created)
  end

  def update_routine(id, attrs) do
    case get_routine(id) do
      nil -> {:error, :not_found}

      routine ->
        routine
        |> Routine.changeset(attrs)
        |> Repo.update()
        |> tap_broadcast(:routine_updated)
    end
  end

  def delete_routine(id) do
    case get_routine(id) do
      nil -> {:error, :not_found}
      routine -> Repo.delete(routine) |> tap_broadcast(:routine_deleted)
    end
  end

  def toggle(id) do
    case get_routine(id) do
      nil -> {:error, :not_found}

      routine ->
        routine
        |> Routine.changeset(%{active: !routine.active})
        |> Repo.update()
        |> tap_broadcast(:routine_toggled)
    end
  end

  def mark_run(id) do
    update_routine(id, %{last_run_at: DateTime.utc_now()})
  end

  defp tap_broadcast(result, event) do
    case result do
      {:ok, record} ->
        Phoenix.PubSub.broadcast(Ema.PubSub, "routines:updates", {event, record})
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
