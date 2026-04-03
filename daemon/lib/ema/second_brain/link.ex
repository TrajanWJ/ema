defmodule Ema.SecondBrain.Link do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @valid_link_types ~w(wikilink tag embed reference)
  @valid_edge_types ~w(references depends-on implements contradicts blocks enables supersedes part-of related-to)

  schema "vault_links" do
    field :link_text, :string
    field :link_type, :string, default: "wikilink"
    field :edge_type, :string, default: "references"
    field :context, :string
    field :metadata, :string

    belongs_to :source_note, Ema.SecondBrain.Note, type: :string
    belongs_to :target_note, Ema.SecondBrain.Note, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(link, attrs) do
    link
    |> cast(attrs, [:id, :link_text, :link_type, :edge_type, :context, :metadata, :source_note_id, :target_note_id])
    |> validate_required([:id, :link_text, :source_note_id])
    |> validate_inclusion(:link_type, @valid_link_types)
    |> validate_inclusion(:edge_type, @valid_edge_types)
    |> foreign_key_constraint(:source_note_id)
    |> foreign_key_constraint(:target_note_id)
  end

  def valid_edge_types, do: @valid_edge_types
end
