defmodule Ema.CliManager.CliSession do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @valid_statuses ~w(running idle crashed completed stopped)

  schema "cli_sessions" do
    field :project_path, :string
    field :status, :string, default: "running"
    field :pid, :integer
    field :prompt, :string
    field :started_at, :utc_datetime
    field :ended_at, :utc_datetime
    field :linked_task_id, :string
    field :linked_proposal_id, :string
    field :output_summary, :string
    field :exit_code, :integer

    belongs_to :cli_tool, Ema.CliManager.CliTool, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(session, attrs) do
    session
    |> cast(attrs, [
      :id, :cli_tool_id, :project_path, :status, :pid, :prompt,
      :started_at, :ended_at, :linked_task_id, :linked_proposal_id,
      :output_summary, :exit_code
    ])
    |> validate_required([:cli_tool_id, :project_path, :prompt])
    |> validate_inclusion(:status, @valid_statuses)
  end
end
