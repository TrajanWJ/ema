defmodule Ema.FileVault.VaultFile do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "vault_files" do
    field :name, :string
    field :path, :string
    field :size_bytes, :integer, default: 0
    field :mime_type, :string
    field :checksum_sha256, :string
    field :encrypted, :boolean, default: false
    field :uploaded_by, :string

    timestamps(type: :utc_datetime)
  end

  @required_fields ~w(name path size_bytes)a
  @optional_fields ~w(mime_type checksum_sha256 encrypted uploaded_by)a

  def changeset(file, attrs) do
    file
    |> cast(attrs, [:id | @required_fields] ++ @optional_fields)
    |> validate_required([:id | @required_fields])
    |> unique_constraint(:path)
  end
end
