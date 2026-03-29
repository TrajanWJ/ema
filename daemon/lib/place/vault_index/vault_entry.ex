defmodule Place.VaultIndex.VaultEntry do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:path, :string, autogenerate: false}

  schema "vault_index" do
    field :title, :string
    field :tags, :string
    field :modified_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [:path, :title, :tags, :modified_at])
    |> validate_required([:path])
  end
end
