defmodule Ema.Knowledge.WikiSection do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "wiki_sections" do
    field :heading, :string
    field :section_key, :string
    field :ordinal, :integer, default: 0
    field :content, :string

    belongs_to :source, Ema.Knowledge.WikiSource, type: :string
    has_many :knowledge_items, Ema.Knowledge.KnowledgeItem, foreign_key: :source_section_id

    timestamps(type: :utc_datetime)
  end

  def changeset(section, attrs) do
    section
    |> cast(attrs, [:id, :source_id, :heading, :section_key, :ordinal, :content])
    |> validate_required([:id, :source_id, :section_key, :ordinal])
    |> unique_constraint([:source_id, :section_key])
  end
end
