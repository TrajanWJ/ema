defmodule Ema.Intents.Schematic.Contradiction do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @severities ~w(low medium high critical)
  @statuses ~w(open acknowledged resolved dismissed)

  schema "schematic_contradictions" do
    field :scope_path, :string
    field :description, :string
    field :severity, :string, default: "medium"
    field :detected_by, :string
    field :status, :string, default: "open"
    field :resolution_notes, :string
    field :resolved_at, :utc_datetime
    field :resolution_actor, :string

    belongs_to :intent_a, Ema.Intents.Intent, type: :string
    belongs_to :intent_b, Ema.Intents.Intent, type: :string

    timestamps(type: :utc_datetime)
  end

  def changeset(contradiction, attrs) do
    contradiction
    |> cast(attrs, [
      :id,
      :scope_path,
      :intent_a_id,
      :intent_b_id,
      :description,
      :severity,
      :detected_by,
      :status,
      :resolution_notes,
      :resolved_at,
      :resolution_actor
    ])
    |> validate_required([:intent_a_id, :description])
    |> validate_inclusion(:severity, @severities)
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
    "sct_#{ts}_#{rand}"
  end
end
