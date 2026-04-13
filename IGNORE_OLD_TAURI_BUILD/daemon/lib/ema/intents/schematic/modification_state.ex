defmodule Ema.Intents.Schematic.ModificationState do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "schematic_modification_state" do
    field :scope_path, :string, default: ""
    field :enabled, :boolean, default: true
    field :disabled_reason, :string
    field :disabled_until, :utc_datetime
    field :updated_by, :string

    timestamps(type: :utc_datetime)
  end

  def changeset(state, attrs) do
    state
    |> cast(attrs, [
      :id,
      :scope_path,
      :enabled,
      :disabled_reason,
      :disabled_until,
      :updated_by
    ])
    |> validate_required([:enabled])
    |> maybe_generate_id()
    |> unique_constraint(:scope_path)
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
    "smod_#{ts}_#{rand}"
  end
end
