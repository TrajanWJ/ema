defmodule Ema.IntentionFarmer.HarvestedSession do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @valid_statuses ~w(pending processed empty duplicate merged)
  @valid_source_types ~w(
    claude_code
    claude_task
    codex_cli
    codex_history
    openclaw_event
    openclaw_config
    external_import
  )

  schema "harvested_sessions" do
    field :session_id, :string
    field :source_type, :string
    field :raw_path, :string
    field :project_path, :string
    field :model, :string
    field :model_provider, :string
    field :started_at, :utc_datetime
    field :ended_at, :utc_datetime
    field :status, :string, default: "pending"
    field :quality_score, :float
    field :message_count, :integer, default: 0
    field :tool_call_count, :integer, default: 0
    field :token_count, :integer, default: 0
    field :files_touched, {:array, :string}, default: []
    field :source_fingerprint, :string
    field :metadata, :map, default: %{}
    field :claude_session_id, :string

    belongs_to :project, Ema.Projects.Project, type: :string
    has_many :intents, Ema.IntentionFarmer.HarvestedIntent, foreign_key: :harvested_session_id

    timestamps(type: :utc_datetime)
  end

  def changeset(session, attrs) do
    session
    |> cast(attrs, [
      :id,
      :session_id,
      :source_type,
      :raw_path,
      :project_path,
      :model,
      :model_provider,
      :started_at,
      :ended_at,
      :status,
      :quality_score,
      :message_count,
      :tool_call_count,
      :token_count,
      :files_touched,
      :source_fingerprint,
      :metadata,
      :claude_session_id,
      :project_id
    ])
    |> validate_required([:id, :source_type, :raw_path])
    |> validate_inclusion(:status, @valid_statuses)
    |> validate_inclusion(:source_type, @valid_source_types)
    |> unique_constraint(:source_fingerprint)
  end
end
