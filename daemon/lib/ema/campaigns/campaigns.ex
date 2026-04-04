defmodule Ema.Campaigns do
  @moduledoc """
  Context module for campaign lifecycle management.
  Provides CRUD + state-machine transitions for Campaign.Flow.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Campaigns.Flow

  # ---------------------------------------------------------------------------
  # CRUD
  # ---------------------------------------------------------------------------

  def list_flows do
    Flow |> order_by(desc: :inserted_at) |> Repo.all()
  end

  def list_flows_by_state(state) do
    Flow
    |> where([f], f.state == ^state)
    |> order_by(desc: :inserted_at)
    |> Repo.all()
  end

  def get_flow(id), do: Repo.get(Flow, id)
  def get_flow!(id), do: Repo.get!(Flow, id)

  def get_flow_by_campaign(campaign_id) do
    Repo.get_by(Flow, campaign_id: campaign_id)
  end

  @doc """
  Creates a new campaign flow, always starting in the `forming` state.
  Required attrs: campaign_id. Optional: title, state_metadata.
  """
  def create_flow(attrs) do
    %Flow{}
    |> Flow.creation_changeset(attrs)
    |> Repo.insert()
  end

  def update_flow(%Flow{} = flow, attrs) do
    flow
    |> Flow.changeset(attrs)
    |> Repo.update()
  end

  def delete_flow(%Flow{} = flow) do
    Repo.delete(flow)
  end

  # ---------------------------------------------------------------------------
  # State machine
  # ---------------------------------------------------------------------------

  @doc """
  Transitions a flow to `new_state`. Returns {:ok, flow} or {:error, changeset}.
  Metadata is recorded alongside the transition in state_history.
  """
  def transition(%Flow{} = flow, new_state, metadata \\ %{}) do
    flow
    |> Flow.transition_changeset(new_state, metadata)
    |> Repo.update()
  end

  @doc """
  Convenience: looks up by id and transitions.
  Returns {:error, :not_found} if the flow doesn't exist.
  """
  def transition_by_id(id, new_state, metadata \\ %{}) do
    case get_flow(id) do
      nil  -> {:error, :not_found}
      flow -> transition(flow, new_state, metadata)
    end
  end

  @doc "Returns the full state history for a flow."
  def history(%Flow{} = flow), do: flow.state_history

  @doc "Returns the human-readable summary of how long the flow spent in each state."
  def state_durations(%Flow{} = flow) do
    flow.state_history
    |> Enum.map(fn entry ->
      entered = parse_dt(entry["entered_at"])
      exited  = if entry["exited_at"], do: parse_dt(entry["exited_at"]), else: DateTime.utc_now()

      diff_sec = DateTime.diff(exited, entered, :second)

      %{
        state:      entry["state"],
        entered_at: entered,
        exited_at:  if(entry["exited_at"], do: exited, else: nil),
        duration_s: diff_sec
      }
    end)
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp parse_dt(iso_string) do
    {:ok, dt, _} = DateTime.from_iso8601(iso_string)
    dt
  end
end
