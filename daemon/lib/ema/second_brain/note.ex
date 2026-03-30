defmodule Ema.SecondBrain.Note do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @valid_source_types ~w(manual proposal session ingestion brain_dump)

  schema "vault_notes" do
    field :file_path, :string
    field :title, :string
    field :space, :string
    field :content_hash, :string
    field :source_type, :string, default: "manual"
    field :source_id, :string
    field :tags, {:array, :string}, default: []
    field :word_count, :integer, default: 0
    field :metadata, :map, default: %{}
    field :project_id, :string

    has_many :outgoing_links, Ema.SecondBrain.Link, foreign_key: :source_note_id
    has_many :incoming_links, Ema.SecondBrain.Link, foreign_key: :target_note_id

    timestamps(type: :utc_datetime)
  end

  def changeset(note, attrs) do
    note
    |> cast(attrs, [
      :id, :file_path, :title, :space, :content_hash,
      :source_type, :source_id, :tags, :word_count,
      :metadata, :project_id
    ])
    |> validate_required([:id, :file_path])
    |> validate_inclusion(:source_type, @valid_source_types)
    |> unique_constraint(:file_path)
  end
end
