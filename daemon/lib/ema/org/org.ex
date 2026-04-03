defmodule Ema.Org do
  @moduledoc """
  Context for multi-organization management.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Org.{Organization, Member, Invitation}

  # --- ID generation (matches project pattern) ---

  defp gen_id(prefix) do
    ts = System.system_time(:second)
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{ts}_#{rand}"
  end

  # --- Organizations ---

  def list_orgs do
    Repo.all(from o in Organization, order_by: [asc: o.inserted_at])
  end

  def get_org(id), do: Repo.get(Organization, id)

  def get_org!(id), do: Repo.get!(Organization, id)

  def get_org_by_slug(slug) do
    Repo.get_by(Organization, slug: slug)
  end

  def create_org(attrs) do
    id = gen_id("org")

    %Organization{}
    |> Organization.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_org(%Organization{} = org, attrs) do
    org
    |> Organization.changeset(attrs)
    |> Repo.update()
  end

  def delete_org(%Organization{} = org) do
    Repo.delete(org)
  end

  @doc """
  Creates the default "Personal" org and owner member on first boot.
  Returns existing personal org if already present.
  """
  def ensure_personal_org(owner_name \\ "Me") do
    case get_org_by_slug("personal") do
      %Organization{} = org ->
        {:ok, org}

      nil ->
        owner_id = gen_id("mbr")

        Repo.transaction(fn ->
          {:ok, org} =
            create_org(%{
              name: "Personal",
              slug: "personal",
              description: "Your personal workspace",
              owner_id: owner_id
            })

          {:ok, _member} =
            create_member(%{
              organization_id: org.id,
              display_name: owner_name,
              role: "owner",
              status: "active",
              joined_at: DateTime.utc_now()
            })

          org
        end)
    end
  end

  # --- Members ---

  def list_members(org_id) do
    Repo.all(
      from m in Member,
        where: m.organization_id == ^org_id,
        order_by: [asc: m.joined_at]
    )
  end

  def get_member(id), do: Repo.get(Member, id)

  def create_member(attrs) do
    id = Map.get(attrs, :id) || gen_id("mbr")

    %Member{}
    |> Member.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_member(%Member{} = member, attrs) do
    member
    |> Member.changeset(attrs)
    |> Repo.update()
  end

  def update_role(org_id, member_id, new_role) do
    case Repo.get_by(Member, id: member_id, organization_id: org_id) do
      nil -> {:error, :not_found}
      member -> update_member(member, %{role: new_role})
    end
  end

  def remove_member(org_id, member_id) do
    case Repo.get_by(Member, id: member_id, organization_id: org_id) do
      nil -> {:error, :not_found}
      member -> Repo.delete(member)
    end
  end

  def touch_last_seen(member_id) do
    case get_member(member_id) do
      nil -> {:error, :not_found}
      member -> update_member(member, %{last_seen_at: DateTime.utc_now()})
    end
  end

  # --- Invitations ---

  def list_invitations(org_id) do
    Repo.all(
      from i in Invitation,
        where: i.organization_id == ^org_id and i.revoked == false,
        order_by: [desc: i.inserted_at]
    )
  end

  def get_invitation_by_token(token) do
    Repo.get_by(Invitation, token: token)
  end

  def create_invitation(org_id, attrs) do
    id = gen_id("inv")
    token = :crypto.strong_rand_bytes(32) |> Base.encode16(case: :lower)

    %Invitation{}
    |> Invitation.changeset(
      attrs
      |> Map.put(:id, id)
      |> Map.put(:organization_id, org_id)
      |> Map.put(:token, token)
    )
    |> Repo.insert()
  end

  def revoke_invitation(invitation_id) do
    case Repo.get(Invitation, invitation_id) do
      nil -> {:error, :not_found}
      inv -> inv |> Invitation.changeset(%{revoked: true}) |> Repo.update()
    end
  end

  @doc """
  Join an org via invitation token. Creates a new member record.
  Returns {:ok, member} or {:error, reason}.
  """
  def join_via_token(token, member_attrs) do
    case get_invitation_by_token(token) do
      nil ->
        {:error, :invalid_token}

      invitation ->
        case Invitation.valid?(invitation) do
          {:error, reason} ->
            {:error, reason}

          :ok ->
            Repo.transaction(fn ->
              {:ok, member} =
                create_member(
                  member_attrs
                  |> Map.put(:organization_id, invitation.organization_id)
                  |> Map.put(:role, invitation.role)
                  |> Map.put(:status, "active")
                  |> Map.put(:joined_at, DateTime.utc_now())
                )

              # Bump use count and record who joined
              used_by = (invitation.used_by || []) ++ [member.id]

              {:ok, _inv} =
                invitation
                |> Invitation.changeset(%{
                  use_count: invitation.use_count + 1,
                  used_by: used_by
                })
                |> Repo.update()

              member
            end)
        end
    end
  end
end
