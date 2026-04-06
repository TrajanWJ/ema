defmodule Ema.Executions.Execution do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "executions" do
    field :project_slug, :string
    field :intent_slug, :string
    field :title, :string
    field :objective, :string
    field :mode, :string, default: "implement"
    field :status, :string, default: "created"
    field :requires_approval, :boolean, default: true
    field :intent_path, :string
    field :result_path, :string
    field :agent_session_id, :string
    field :brain_dump_item_id, :string
    field :metadata, :map, default: %{}
    field :completed_at, :utc_datetime
    field :git_diff, :string

    belongs_to :proposal, Ema.Proposals.Proposal, type: :string
    belongs_to :task, Ema.Tasks.Task, type: :string
    belongs_to :session, Ema.ClaudeSessions.ClaudeSession, type: :string

    has_many :events, Ema.Executions.Event, foreign_key: :execution_id

    timestamps(type: :utc_datetime)
  end

  @valid_modes ~w(research outline implement review harvest refactor)
  @valid_statuses ~w(created proposed awaiting_approval approved delegated running harvesting completed failed cancelled)

  def changeset(execution, attrs) do
    execution
    |> cast(attrs, [
      :id,
      :project_slug,
      :intent_slug,
      :title,
      :objective,
      :mode,
      :status,
      :requires_approval,
      :intent_path,
      :result_path,
      :agent_session_id,
      :brain_dump_item_id,
      :proposal_id,
      :task_id,
      :session_id,
      :metadata,
      :completed_at,
      :git_diff
    ])
    |> validate_required([:id, :title, :mode, :status])
    |> validate_inclusion(:mode, @valid_modes)
    |> validate_inclusion(:status, @valid_statuses)
  end
end
