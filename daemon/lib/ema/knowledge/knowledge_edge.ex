defmodule Ema.Knowledge.KnowledgeEdge do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "knowledge_edges" do
    field :from_kind, :string
    field :from_id, :string
    field :to_kind, :string
    field :to_id, :string
    field :edge_type, :string
    field :metadata, :map, default: %{}

    timestamps(type: :utc_datetime)
  end

  def changeset(edge, attrs) do
    edge
    |> cast(attrs, [:id, :from_kind, :from_id, :to_kind, :to_id, :edge_type, :metadata])
    |> validate_required([:id, :from_kind, :from_id, :to_kind, :to_id, :edge_type])
  end
end
