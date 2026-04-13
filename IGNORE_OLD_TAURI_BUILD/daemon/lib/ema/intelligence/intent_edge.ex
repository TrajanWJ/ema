defmodule Ema.Intelligence.IntentEdge do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "intent_edges" do
    field :edge_type, :string, default: "hierarchy"

    belongs_to :source, Ema.Intelligence.IntentNode, type: :string
    belongs_to :target, Ema.Intelligence.IntentNode, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(edge, attrs) do
    edge
    |> cast(attrs, [:id, :source_id, :target_id, :edge_type])
    |> validate_required([:id, :source_id, :target_id])
  end
end
