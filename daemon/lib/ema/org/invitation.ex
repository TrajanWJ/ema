defmodule Ema.Org.Invitation do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  schema "org_invitations" do
    field :token, :string
    field :role, :string, default: "member"
    field :created_by, :string
    field :expires_at, :utc_datetime
    field :max_uses, :integer
    field :use_count, :integer, default: 0
    field :used_by, {:array, :string}, default: []
    field :revoked, :boolean, default: false

    belongs_to :organization, Ema.Org.Organization, type: :string

    timestamps()
  end

  def changeset(invitation, attrs) do
    invitation
    |> cast(attrs, [
      :id, :organization_id, :token, :role, :created_by,
      :expires_at, :max_uses, :use_count, :used_by, :revoked
    ])
    |> validate_required([:organization_id, :token, :role, :created_by])
    |> validate_inclusion(:role, Ema.Org.Member.roles())
    |> unique_constraint(:token)
  end

  def valid?(%__MODULE__{} = inv) do
    now = DateTime.utc_now()

    cond do
      inv.revoked -> {:error, :revoked}
      inv.expires_at && DateTime.compare(now, inv.expires_at) == :gt -> {:error, :expired}
      inv.max_uses && inv.use_count >= inv.max_uses -> {:error, :max_uses_reached}
      true -> :ok
    end
  end
end
