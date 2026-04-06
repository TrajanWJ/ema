defmodule Ema.Knowledge.WikiSource do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "wiki_sources" do
    field :path, :string
    field :title, :string
    field :source_type, :string, default: "markdown"
    field :space_key, :string
    field :project_key, :string
    field :checksum, :string
    field :metadata, :map, default: %{}

    has_many :sections, Ema.Knowledge.WikiSection, foreign_key: :source_id

    timestamps(type: :utc_datetime)
  end

  @valid_source_types ~w(markdown orgmode plain)

  def changeset(source, attrs) do
    source
    |> cast(attrs, [:id, :path, :title, :source_type, :space_key, :project_key, :checksum, :metadata])
    |> validate_required([:id, :path, :title])
    |> validate_inclusion(:source_type, @valid_source_types)
    |> unique_constraint(:path)
  end
end
