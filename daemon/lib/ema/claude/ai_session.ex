defmodule Ema.Claude.AiSession do
  @moduledoc """
  Schema for AI conversation sessions. Tracks model, cost, token usage,
  and supports resume/fork via parent_session_id.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "ai_sessions" do
    field :model, :string, default: "sonnet"
    field :status, :string, default: "active"
    field :message_count, :integer, default: 0
    field :total_input_tokens, :integer, default: 0
    field :total_output_tokens, :integer, default: 0
    field :cost_usd, :float, default: 0.0
    field :title, :string
    field :project_path, :string
    field :parent_session_id, :string
    field :fork_point_message_id, :string
    field :agent_id, :string
    field :metadata, :map, default: %{}

    has_many :messages, Ema.Claude.AiSessionMessage, foreign_key: :session_id

    timestamps(type: :utc_datetime)
  end

  def changeset(session, attrs) do
    session
    |> cast(attrs, [
      :id, :model, :status, :message_count, :total_input_tokens,
      :total_output_tokens, :cost_usd, :title, :project_path,
      :parent_session_id, :fork_point_message_id, :agent_id, :metadata
    ])
    |> validate_required([:id, :model, :status])
    |> validate_inclusion(:status, ~w(active paused completed error))
  end
end
