defmodule Ema.Claude.AiSessionMessage do
  @moduledoc """
  Schema for messages within an AI session.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "ai_session_messages" do
    field :role, :string
    field :content, :string
    field :token_count, :integer, default: 0
    field :tool_calls, :map, default: %{}
    field :metadata, :map, default: %{}

    belongs_to :session, Ema.Claude.AiSession, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(message, attrs) do
    message
    |> cast(attrs, [:id, :session_id, :role, :content, :token_count, :tool_calls, :metadata])
    |> validate_required([:id, :session_id, :role])
    |> validate_inclusion(:role, ~w(user assistant system tool))
  end
end
