defmodule Ema.Sessions.Checkpoint do
  @moduledoc """
  Schema for session checkpoints — periodic snapshots of agent work state
  that enable crash recovery and session resumption.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "session_checkpoints" do
    field :session_id, :string
    field :execution_id, :string
    field :intent_id, :string
    field :phase, :string
    field :files_modified, {:array, :string}, default: []
    field :conversation_summary, :string
    field :git_diff_summary, :string
    field :last_tool_call, :string
    field :checkpoint_at, :utc_datetime
  end

  @cast_fields [
    :id,
    :session_id,
    :execution_id,
    :intent_id,
    :phase,
    :files_modified,
    :conversation_summary,
    :git_diff_summary,
    :last_tool_call,
    :checkpoint_at
  ]

  def changeset(checkpoint, attrs) do
    checkpoint
    |> cast(attrs, @cast_fields)
    |> validate_required([:id, :session_id, :checkpoint_at])
  end
end
