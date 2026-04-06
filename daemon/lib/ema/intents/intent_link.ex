defmodule Ema.Intents.IntentLink do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  @linkable_types ~w(execution proposal task goal brain_dump session harvest vault_note doc)
  @roles ~w(origin evidence derived related superseded context)
  @provenances ~w(manual approved execution harvest cluster import)

  schema "intent_links" do
    belongs_to :intent, Ema.Intents.Intent, type: :string

    field :linkable_type, :string
    field :linkable_id, :string
    field :role, :string, default: "related"
    field :provenance, :string, default: "manual"

    timestamps(type: :utc_datetime)
  end

  def changeset(link, attrs) do
    link
    |> cast(attrs, [:id, :intent_id, :linkable_type, :linkable_id, :role, :provenance])
    |> validate_required([:intent_id, :linkable_type, :linkable_id])
    |> validate_inclusion(:linkable_type, @linkable_types)
    |> validate_inclusion(:role, @roles)
    |> validate_inclusion(:provenance, @provenances)
    |> maybe_generate_id()
    |> unique_constraint(:intent_id,
      name: :intent_links_unique_triple,
      message: "link already exists"
    )
  end

  defp maybe_generate_id(%{data: %{id: nil}} = changeset) do
    ts = System.system_time(:millisecond)
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    put_change(changeset, :id, "il_#{ts}_#{rand}")
  end
  defp maybe_generate_id(changeset), do: changeset
end
