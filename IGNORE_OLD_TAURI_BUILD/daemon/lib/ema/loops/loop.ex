defmodule Ema.Loops.Loop do
  @moduledoc """
  A Loop is an outbound action awaiting a response. Each loop ages and
  escalates as time passes without closure. Closure is either resolution
  (got a reply, parked, killed) or a forced follow-up.

  Escalation levels:
    0 NEW   — opened in the last 3 days
    1 WARM  — 3-7 days old, gentle nudge
    2 HOT   — 7-14 days old, follow-up needed
    3 FORCE — 14+ days old, decide to close or escalate further
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "loops" do
    field :loop_type, :string
    field :target, :string
    field :context, :string
    field :channel, :string
    field :opened_on, :date
    field :touch_count, :integer, default: 1
    field :escalation_level, :integer, default: 0
    field :last_escalated, :date
    field :status, :string, default: "open"
    field :closed_on, :date
    field :closed_by, :string
    field :closed_reason, :string
    field :follow_up_text, :string

    field :actor_id, :string
    field :project_id, :string
    field :task_id, :string

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(open closed parked killed)

  def changeset(loop, attrs) do
    loop
    |> cast(attrs, [
      :id,
      :loop_type,
      :target,
      :context,
      :channel,
      :opened_on,
      :touch_count,
      :escalation_level,
      :last_escalated,
      :status,
      :closed_on,
      :closed_by,
      :closed_reason,
      :follow_up_text,
      :actor_id,
      :project_id,
      :task_id
    ])
    |> validate_required([:id, :loop_type, :opened_on, :status])
    |> validate_inclusion(:status, @valid_statuses)
    |> validate_number(:escalation_level, greater_than_or_equal_to: 0, less_than_or_equal_to: 3)
  end

  @doc "Map age in days to escalation level (0..3)."
  def escalation_for_age(days) when days >= 14, do: 3
  def escalation_for_age(days) when days >= 7, do: 2
  def escalation_for_age(days) when days >= 3, do: 1
  def escalation_for_age(_), do: 0

  @doc "Human label for an escalation level."
  def level_label(0), do: "NEW"
  def level_label(1), do: "WARM"
  def level_label(2), do: "HOT"
  def level_label(3), do: "FORCE"
  def level_label(_), do: "?"

  @doc "Age of the loop in whole days, relative to today (UTC)."
  def age_days(%__MODULE__{opened_on: %Date{} = opened}) do
    Date.diff(Date.utc_today(), opened)
  end

  def age_days(_), do: 0
end
