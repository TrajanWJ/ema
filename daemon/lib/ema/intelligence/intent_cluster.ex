defmodule Ema.Intelligence.IntentCluster do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "intent_clusters" do
    field :label, :string
    field :description, :string
    field :readiness_score, :float, default: 0.0
    field :item_count, :integer, default: 0
    field :promoted, :boolean, default: false
    field :seed_id, :string
    field :status, :string, default: "forming"

    # Brain-dump-to-proposal loop fields
    field :source_fingerprint, :string
    field :proposal_id, :string
    field :centroid_embedding, :binary
    field :last_evaluated_at, :utc_datetime

    belongs_to :project, Ema.Projects.Project, type: :string
    belongs_to :space, Ema.Spaces.Space, type: :string
    belongs_to :intent_node, Ema.Intelligence.IntentNode, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(forming ready promoted dismissed)

  def changeset(cluster, attrs) do
    cluster
    |> cast(attrs, [
      :id, :label, :description, :readiness_score, :item_count,
      :promoted, :seed_id, :status, :project_id, :space_id, :intent_node_id,
      :source_fingerprint, :proposal_id, :centroid_embedding, :last_evaluated_at
    ])
    |> validate_required([:id, :label])
    |> validate_inclusion(:status, @valid_statuses)
    |> unique_constraint(:source_fingerprint)
  end
end
