defmodule Ema.IntentionFarmer.HarvestedIntent do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @valid_intent_types ~w(goal question task exploration fix)
  @valid_source_types ~w(
    claude_code
    claude_task
    codex_cli
    codex_history
    openclaw_event
    openclaw_config
    external_import
  )

  schema "harvested_intents" do
    field :content, :string
    field :intent_type, :string
    field :source_type, :string
    field :source_fingerprint, :string
    field :quality_score, :float, default: 0.0
    field :loaded, :boolean, default: false
    field :brain_dump_item_id, :string
    field :metadata, :map, default: %{}

    belongs_to :harvested_session, Ema.IntentionFarmer.HarvestedSession, type: :string
    belongs_to :project, Ema.Projects.Project, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(intent, attrs) do
    intent
    |> cast(attrs, [
      :id,
      :content,
      :intent_type,
      :source_type,
      :source_fingerprint,
      :quality_score,
      :loaded,
      :brain_dump_item_id,
      :metadata,
      :harvested_session_id,
      :project_id
    ])
    |> validate_required([:id, :content, :source_type])
    |> validate_inclusion(:intent_type, @valid_intent_types)
    |> validate_inclusion(:source_type, @valid_source_types)
    |> unique_constraint(:source_fingerprint)
  end
end
