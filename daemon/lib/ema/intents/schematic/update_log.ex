defmodule Ema.Intents.Schematic.UpdateLog do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "schematic_update_log" do
    field :scope_path, :string
    field :input_text, :string
    field :parsed_mutations, :map, default: %{}
    field :applied, :boolean, default: false
    field :affected_intent_ids, {:array, :string}, default: []
    field :contradictions_raised, {:array, :string}, default: []
    field :clarifications_raised, {:array, :string}, default: []
    field :actor_id, :string
    field :error, :string

    timestamps(type: :utc_datetime)
  end

  def changeset(log, attrs) do
    log
    |> cast(attrs, [
      :id,
      :scope_path,
      :input_text,
      :parsed_mutations,
      :applied,
      :affected_intent_ids,
      :contradictions_raised,
      :clarifications_raised,
      :actor_id,
      :error
    ])
    |> validate_required([:input_text])
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
    "sul_#{ts}_#{rand}"
  end
end
