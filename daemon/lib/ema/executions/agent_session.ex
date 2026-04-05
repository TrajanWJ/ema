defmodule Ema.Executions.AgentSession do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "agent_sessions" do
    field :agent_role,     :string, default: "implementer"
    field :status,         :string, default: "pending"
    field :transcript_ref, :string
    field :prompt_sent,    :string
    field :result_summary, :string
    field :started_at,     :utc_datetime
    field :ended_at,       :utc_datetime
    field :metadata,       :map, default: %{}

    belongs_to :execution, Ema.Executions.Execution, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(pending running completed failed cancelled)
  @valid_roles    ~w(implementer researcher reviewer refactorer harvester outliner)

  def changeset(session, attrs) do
    session
    |> cast(attrs, [
      :id, :execution_id, :agent_role, :status, :transcript_ref,
      :prompt_sent, :result_summary, :started_at, :ended_at, :metadata
    ])
    |> validate_required([:id, :agent_role, :status])
    |> validate_inclusion(:status, @valid_statuses)
    |> validate_inclusion(:agent_role, @valid_roles)
    |> foreign_key_constraint(:execution_id)
  end
end
