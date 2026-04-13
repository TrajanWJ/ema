defmodule Ema.Org.Member do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  @roles ~w(owner admin member guest)
  @statuses ~w(active invited suspended)

  schema "org_members" do
    field :display_name, :string
    field :email, :string
    field :role, :string, default: "member"
    field :public_key, :string
    field :status, :string, default: "active"
    field :joined_at, :utc_datetime
    field :last_seen_at, :utc_datetime

    belongs_to :organization, Ema.Org.Organization, type: :string

    timestamps()
  end

  def changeset(member, attrs) do
    member
    |> cast(attrs, [
      :id,
      :organization_id,
      :display_name,
      :email,
      :role,
      :public_key,
      :status,
      :joined_at,
      :last_seen_at
    ])
    |> validate_required([:organization_id, :display_name, :role, :status])
    |> validate_inclusion(:role, @roles)
    |> validate_inclusion(:status, @statuses)
    |> unique_constraint([:organization_id, :email])
  end

  def roles, do: @roles
  def statuses, do: @statuses
end
