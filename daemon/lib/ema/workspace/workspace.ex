defmodule Ema.Workspace do
  @moduledoc """
  Tracks open/closed state and position/size of app windows for workspace restoration.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Workspace.WindowState

  def list_all do
    Repo.all(WindowState)
  end

  def list_open do
    WindowState
    |> where([w], w.is_open == true)
    |> Repo.all()
  end

  def get_by_app_id(app_id) do
    Repo.get_by(WindowState, app_id: app_id)
  end

  def upsert(app_id, attrs) do
    case get_by_app_id(app_id) do
      nil ->
        %WindowState{}
        |> WindowState.changeset(Map.put(attrs, :app_id, app_id))
        |> Repo.insert()

      existing ->
        existing
        |> WindowState.changeset(attrs)
        |> Repo.update()
    end
  end

  def mark_open(app_id, attrs \\ %{}) do
    upsert(app_id, Map.put(attrs, :is_open, true))
  end

  def mark_closed(app_id, attrs \\ %{}) do
    upsert(app_id, Map.put(attrs, :is_open, false))
  end

  def close_all do
    from(w in WindowState, where: w.is_open == true)
    |> Repo.update_all(set: [is_open: false, updated_at: DateTime.utc_now()])
  end
end
