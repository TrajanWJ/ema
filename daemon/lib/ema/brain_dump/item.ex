defmodule Ema.BrainDump.Item do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "inbox_items" do
    field :content, :string
    field :source, :string, default: "text"
    field :processed, :boolean, default: false
    field :action, :string
    field :processed_at, :utc_datetime

    # Embedding fields for brain-dump-to-proposal clustering
    field :embedding, :binary
    field :embedding_version, :string
    field :embedding_status, :string, default: "pending"
    field :surfaced_proposal_id, :string

    belongs_to :project, Ema.Projects.Project, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_sources ~w(text shortcut clipboard harvested)
  @valid_actions ~w(task journal archive note processing)

  def create_changeset(item, attrs) do
    item
    |> cast(attrs, [:id, :content, :source])
    |> validate_required([:id, :content])
    |> validate_inclusion(:source, @valid_sources)
  end

  def process_changeset(item, attrs) do
    item
    |> cast(attrs, [:processed, :action, :processed_at])
    |> validate_required([:processed, :action])
    |> validate_inclusion(:action, @valid_actions)
  end

  @doc "Cast project_id onto an existing item."
  def link_changeset(item, attrs) do
    item
    |> cast(attrs, [:project_id])
  end
end
