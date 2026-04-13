defmodule Ema.Spaces.Member do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  @roles ~w(owner editor viewer)

  schema "space_members" do
    field :identity_id, :string
    field :role, :string, default: "viewer"
    field :joined_at, :utc_datetime
    field :revoked_at, :utc_datetime

    belongs_to :space, Ema.Spaces.Space, type: :string

    timestamps()
  end

  def changeset(member, attrs) do
    member
    |> cast(attrs, [:id, :space_id, :identity_id, :role, :joined_at, :revoked_at])
    |> validate_required([:space_id, :identity_id, :role])
    |> validate_inclusion(:role, @roles)
    |> unique_constraint([:space_id, :identity_id])
  end

  def roles, do: @roles
end
