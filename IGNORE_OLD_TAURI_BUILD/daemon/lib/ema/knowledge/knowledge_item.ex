defmodule Ema.Knowledge.KnowledgeItem do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @valid_kinds ~w(entity intent decision question evidence)
  @valid_statuses ~w(active resolved stale candidate)

  schema "knowledge_items" do
    field :kind, :string
    field :text, :string
    field :normalized_key, :string
    field :confidence, :float, default: 0.5
    field :status, :string, default: "active"

    belongs_to :source_section, Ema.Knowledge.WikiSection, type: :string
    belongs_to :project, Ema.Projects.Project, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :id,
      :kind,
      :text,
      :normalized_key,
      :confidence,
      :status,
      :source_section_id,
      :project_id
    ])
    |> validate_required([:id, :kind, :text])
    |> validate_inclusion(:kind, @valid_kinds)
    |> validate_inclusion(:status, @valid_statuses)
    |> validate_number(:confidence, greater_than_or_equal_to: 0.0, less_than_or_equal_to: 1.0)
  end
end
