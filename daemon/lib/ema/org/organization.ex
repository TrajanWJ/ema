defmodule Ema.Org.Organization do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  schema "organizations" do
    field :name, :string
    field :slug, :string
    field :description, :string
    field :avatar_url, :string
    field :owner_id, :string
    field :settings, :map, default: %{}

    has_many :members, Ema.Org.Member, foreign_key: :organization_id
    has_many :invitations, Ema.Org.Invitation, foreign_key: :organization_id

    timestamps()
  end

  def changeset(org, attrs) do
    org
    |> cast(attrs, [:id, :name, :slug, :description, :avatar_url, :owner_id, :settings])
    |> validate_required([:name, :slug, :owner_id])
    |> validate_format(:slug, ~r/^[a-z0-9][a-z0-9-]*$/,
      message: "must be lowercase alphanumeric with dashes"
    )
    |> validate_length(:name, min: 1, max: 100)
    |> validate_length(:slug, min: 1, max: 50)
    |> unique_constraint(:slug)
  end
end
