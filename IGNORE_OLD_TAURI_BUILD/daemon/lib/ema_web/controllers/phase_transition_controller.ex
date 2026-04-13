defmodule EmaWeb.PhaseTransitionController do
  use EmaWeb, :controller

  alias Ema.Actors

  action_fallback EmaWeb.FallbackController

  def index(conn, %{"actor_id" => actor_id}) do
    rows = Actors.list_phase_transitions(actor_id)
    json(conn, %{phase_transitions: Enum.map(rows, &serialize/1)})
  end

  def create(conn, params) do
    with {:ok, row} <- Actors.record_phase_transition(params) do
      conn
      |> put_status(:created)
      |> json(%{phase_transition: serialize(row)})
    end
  end

  defp serialize(row) do
    %{
      id: row.id,
      actor_id: row.actor_id,
      space_id: row.space_id,
      project_id: row.project_id,
      from_phase: row.from_phase,
      to_phase: row.to_phase,
      week_number: row.week_number,
      reason: row.reason,
      summary: row.summary,
      metadata: row.metadata,
      transitioned_at: row.transitioned_at
    }
  end
end
