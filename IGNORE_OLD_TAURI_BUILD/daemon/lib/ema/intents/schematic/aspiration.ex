defmodule Ema.Intents.Schematic.Aspiration do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @horizons ~w(short medium long lifetime)
  @statuses ~w(stacked active promoted archived retired)

  schema "schematic_aspirations" do
    field :scope_path, :string
    field :title, :string
    field :description, :string
    field :horizon, :string, default: "long"
    field :status, :string, default: "stacked"
    field :weight, :integer, default: 0
    field :tags, {:array, :string}, default: []

    belongs_to :promoted_intent, Ema.Intents.Intent, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(aspiration, attrs) do
    aspiration
    |> cast(attrs, [
      :id,
      :scope_path,
      :title,
      :description,
      :horizon,
      :status,
      :promoted_intent_id,
      :weight,
      :tags
    ])
    |> validate_required([:title])
    |> validate_inclusion(:horizon, @horizons)
    |> validate_inclusion(:status, @statuses)
    |> maybe_generate_id()
  end

  defp maybe_generate_id(changeset) do
    case get_field(changeset, :id) do
      nil -> put_change(changeset, :id, new_id())
      _ -> changeset
    end
  end

  defp new_id do
    ts = System.system_time(:millisecond)
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "sasp_#{ts}_#{rand}"
  end
end
