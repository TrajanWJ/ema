defmodule Ema.ClaudeSessions.ClaudeSession do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "claude_sessions" do
    field :project_path, :string
    field :started_at, :utc_datetime
    field :last_active, :utc_datetime
    field :summary, :string
    field :token_count, :integer
    field :status, :string, default: "active"

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(active paused completed)

  def changeset(session, attrs) do
    session
    |> cast(attrs, [:id, :project_path, :started_at, :last_active, :summary, :token_count, :status])
    |> validate_required([:id])
    |> validate_inclusion(:status, @valid_statuses)
  end
end
