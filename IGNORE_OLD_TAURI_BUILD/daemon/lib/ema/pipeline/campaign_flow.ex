defmodule Ema.Pipeline.CampaignFlow do
  @moduledoc """
  Campaign state machine — tracks multi-step execution sequences.
  A campaign sequences modes: research → outline → implement → review → completed.
  Pure logic module — no side effects, no DB, no PubSub.
  """

  @states ~w(created planning researching outlining implementing reviewing completed failed cancelled)

  @transitions %{
    "created" => ["planning", "cancelled"],
    "planning" => ["researching", "outlining", "cancelled"],
    "researching" => ["outlining", "failed", "cancelled"],
    "outlining" => ["implementing", "failed", "cancelled"],
    "implementing" => ["reviewing", "failed", "cancelled"],
    "reviewing" => ["completed", "implementing", "failed", "cancelled"],
    "completed" => [],
    "failed" => ["planning"],
    "cancelled" => []
  }

  @mode_to_state %{
    "research" => "researching",
    "outline" => "outlining",
    "implement" => "implementing",
    "review" => "reviewing"
  }

  def states, do: @states

  def valid_transition?(from, to), do: to in Map.get(@transitions, from, [])

  def next_states(current), do: Map.get(@transitions, current, [])

  @doc "Advance a campaign struct/map to a new state. Returns {:ok, updated} or {:error, reason}."
  def transition(campaign, to_state) do
    if valid_transition?(campaign.status, to_state) do
      {:ok, Map.put(campaign, :status, to_state)}
    else
      {:error, {:invalid_transition, campaign.status, to_state}}
    end
  end

  @doc "Map an execution mode to the corresponding campaign state."
  def state_for_mode(mode), do: Map.get(@mode_to_state, mode, "planning")

  @doc "Returns true if the campaign is in a terminal state."
  def terminal?(campaign), do: campaign.status in ["completed", "failed", "cancelled"]
end
