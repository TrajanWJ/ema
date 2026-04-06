defmodule Ema.Memory.SessionEntry do
  @moduledoc """
  Session-level memory — working context captured during a Claude/agent session.
  Analogous to Honcho's session + message memory layers.

  Kinds:
    - "context" — general working state
    - "decision" — a decision made during the session
    - "insight" — something learned
    - "blocker" — an obstacle noted
    - "outcome" — final result of the session
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @kinds ~w(context decision insight blocker outcome code_change)

  schema "memory_session_entries" do
    field :session_id, :string
    field :user_id, :string, default: "trajan"
    field :project_slug, :string
    field :kind, :string, default: "context"
    field :content, :string
    field :weight, :float, default: 0.5
    field :metadata, :map, default: %{}

    timestamps(type: :utc_datetime)
  end

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :id,
      :session_id,
      :user_id,
      :project_slug,
      :kind,
      :content,
      :weight,
      :metadata
    ])
    |> validate_required([:id, :session_id, :content])
    |> validate_inclusion(:kind, @kinds)
    |> validate_number(:weight, greater_than_or_equal_to: 0.0, less_than_or_equal_to: 1.0)
  end
end
