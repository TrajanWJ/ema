defmodule Ema.Campaigns.Flow do
  @moduledoc """
  Campaign.Flow — 5-state machine tracking the lifecycle of a campaign.

  State machine:
    Forming → Ready → Running → Completed (sink: Archived)

  Valid transitions:
    forming    → developing, done (abandoned)
    developing → testing, forming (rethink), done (abandoned)
    testing    → done, developing (back)
    done       → (terminal)
    archived  → (terminal)

  Each state records when it was entered and optional metadata.
  Full history is preserved in :state_history.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @states ~w(forming developing testing done)

  @valid_transitions %{
    "forming"    => ~w(developing done),
    "developing" => ~w(testing forming),
    "testing"    => ~w(done developing),
    "done"       => []
  }

  schema "campaign_flows" do
    field :campaign_id,    :string
    field :title,          :string
    field :state,          :string,  default: "forming"
    field :state_entered_at, :utc_datetime
    field :state_metadata, :map,    default: %{}

    # JSON array of historical state entries:
    # [%{state, entered_at, exited_at, metadata}]
    field :state_history, {:array, :map}, default: []

    timestamps(type: :utc_datetime)
  end

  # ---------------------------------------------------------------------------
  # Changesets
  # ---------------------------------------------------------------------------

  def changeset(flow, attrs) do
    flow
    |> cast(attrs, [:id, :campaign_id, :title, :state, :state_entered_at,
                    :state_metadata, :state_history])
    |> validate_required([:id, :campaign_id])
    |> validate_inclusion(:state, @states)
    |> unique_constraint(:campaign_id)
  end

  def creation_changeset(flow, attrs) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    attrs =
      attrs
      |> Map.put_new(:id, generate_id())
      |> Map.put_new(:state, "forming")
      |> Map.put_new(:state_entered_at, now)
      |> Map.put_new(:state_history, [
        %{"state" => "forming", "entered_at" => DateTime.to_iso8601(now),
          "exited_at" => nil, "metadata" => %{}}
      ])

    changeset(flow, attrs)
  end

  @doc """
  Changeset for transitioning to a new state.
  Validates the transition is allowed, appends history, sets entered_at.
  """
  def transition_changeset(%__MODULE__{} = flow, new_state, metadata \\ %{}) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    now_iso = DateTime.to_iso8601(now)

    updated_history =
      Enum.map(flow.state_history, fn entry ->
        if entry["state"] == flow.state && is_nil(entry["exited_at"]) do
          Map.put(entry, "exited_at", now_iso)
        else
          entry
        end
      end)

    new_entry = %{
      "state"      => new_state,
      "entered_at" => now_iso,
      "exited_at"  => nil,
      "metadata"   => metadata
    }

    flow
    |> changeset(%{
      state:           new_state,
      state_entered_at: now,
      state_metadata:  metadata,
      state_history:   updated_history ++ [new_entry]
    })
    |> validate_transition(flow.state, new_state)
  end

  # ---------------------------------------------------------------------------
  # Public helpers
  # ---------------------------------------------------------------------------

  @doc "Returns true if the transition from `from` to `to` is valid."
  def valid_transition?(from, to) do
    to in Map.get(@valid_transitions, from, [])
  end

  @doc "Returns the list of states reachable from `state`."
  def valid_transitions(state) do
    Map.get(@valid_transitions, state, [])
  end

  @doc "Returns all defined states in order."
  def states, do: @states

  @doc "Alias for valid_transition?/2."
  def can_transition?(from, to), do: valid_transition?(from, to)

  # ---------------------------------------------------------------------------
  # Campaign status transitions (separate from Flow's own state machine)
  # ---------------------------------------------------------------------------

  @campaign_transitions %{
    "forming"   => ~w(ready running archived),
    "ready"     => ~w(running forming archived),
    "running"   => ~w(completed forming archived),
    "completed" => ~w(archived),
    "archived"  => []
  }

  @doc "Returns true if the campaign status transition from `from` to `to` is valid."
  def campaign_valid_transition?(from, to) do
    to in Map.get(@campaign_transitions, from, [])
  end

  @doc "Returns the list of campaign statuses reachable from `state`."
  def campaign_valid_transitions(state) do
    Map.get(@campaign_transitions, state, [])
  end

  @doc "Builds a flow-like map from a Campaign struct (reads status, defaults to forming)."
  def from_campaign(%{status: status} = _campaign) do
    %{state: status || "forming", valid_next: valid_transitions(status || "forming")}
  end

  @doc """
  Transitions a persisted Flow to a new state.
  Returns {:ok, flow} or {:error, changeset}.
  """
  def transition(%__MODULE__{} = flow, new_state, metadata \\ %{}) do
    flow
    |> transition_changeset(new_state, metadata)
    |> Ema.Repo.update()
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp validate_transition(changeset, from, to) do
    if valid_transition?(from, to) do
      changeset
    else
      add_error(changeset, :state,
        "invalid transition from #{from} to #{to}; allowed: #{inspect(valid_transitions(from))}")
    end
  end

  defp generate_id do
    ts  = System.system_time(:millisecond) |> Integer.to_string()
    rnd = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "flow_#{ts}_#{rnd}"
  end
end
