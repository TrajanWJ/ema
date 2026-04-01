defmodule Ema.ClaudeSessions.ClaudeSession do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "claude_sessions" do
    field :session_id, :string
    field :project_path, :string
    field :started_at, :utc_datetime
    field :ended_at, :utc_datetime
    field :last_active, :utc_datetime
    field :status, :string, default: "active"
    field :token_count, :integer
    field :tool_calls, :integer
    field :files_touched, {:array, :string}, default: []
    field :summary, :string
    field :raw_path, :string
    field :metadata, :map, default: %{}

    belongs_to :project, Ema.Projects.Project, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(active completed abandoned)

  def changeset(session, attrs) do
    session
    |> cast(attrs, [
      :id,
      :session_id,
      :project_path,
      :started_at,
      :ended_at,
      :last_active,
      :summary,
      :token_count,
      :tool_calls,
      :files_touched,
      :raw_path,
      :metadata,
      :status,
      :project_id
    ])
    |> validate_required([:id])
    |> validate_inclusion(:status, @valid_statuses)
  end
end
