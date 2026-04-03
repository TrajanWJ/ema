defmodule EmaWeb.OrgController do
  use EmaWeb, :controller

  alias Ema.Org

  action_fallback EmaWeb.FallbackController

  # GET /api/orgs
  def index(conn, _params) do
    orgs = Org.list_orgs() |> Enum.map(&serialize_org/1)
    json(conn, %{orgs: orgs})
  end

  # POST /api/orgs
  def create(conn, params) do
    attrs = %{
      name: params["name"],
      slug: params["slug"],
      description: params["description"],
      avatar_url: params["avatar_url"],
      owner_id: params["owner_id"] || "local",
      settings: params["settings"] || %{}
    }

    with {:ok, org} <- Org.create_org(attrs) do
      EmaWeb.Endpoint.broadcast("orgs:lobby", "org_created", serialize_org(org))

      conn
      |> put_status(:created)
      |> json(serialize_org(org))
    end
  end

  # GET /api/orgs/:id
  def show(conn, %{"id" => id}) do
    case Org.get_org(id) do
      nil ->
        {:error, :not_found}

      org ->
        members = Org.list_members(org.id) |> Enum.map(&serialize_member/1)
        invitations = Org.list_invitations(org.id) |> Enum.map(&serialize_invitation/1)

        json(conn, %{
          org: serialize_org(org),
          members: members,
          invitations: invitations
        })
    end
  end

  # PUT /api/orgs/:id
  def update(conn, %{"id" => id} = params) do
    case Org.get_org(id) do
      nil ->
        {:error, :not_found}

      org ->
        attrs = %{
          name: params["name"],
          description: params["description"],
          avatar_url: params["avatar_url"],
          settings: params["settings"]
        }

        with {:ok, updated} <- Org.update_org(org, attrs) do
          EmaWeb.Endpoint.broadcast("orgs:#{id}", "org_updated", serialize_org(updated))
          json(conn, serialize_org(updated))
        end
    end
  end

  # DELETE /api/orgs/:id
  def delete(conn, %{"id" => id}) do
    case Org.get_org(id) do
      nil -> {:error, :not_found}
      org ->
        with {:ok, _} <- Org.delete_org(org) do
          EmaWeb.Endpoint.broadcast("orgs:lobby", "org_deleted", %{id: id})
          json(conn, %{ok: true})
        end
    end
  end

  # POST /api/orgs/:id/invitations
  def create_invitation(conn, %{"id" => org_id} = params) do
    attrs = %{
      role: params["role"] || "member",
      created_by: params["created_by"] || "local",
      expires_at: parse_expires_at(params["expires_at"]),
      max_uses: params["max_uses"]
    }

    with {:ok, inv} <- Org.create_invitation(org_id, attrs) do
      link = "ema://join/#{inv.token}"

      EmaWeb.Endpoint.broadcast("orgs:#{org_id}", "invitation_created", serialize_invitation(inv))

      conn
      |> put_status(:created)
      |> json(%{invitation: serialize_invitation(inv), link: link})
    end
  end

  # DELETE /api/orgs/:org_id/invitations/:id
  def revoke_invitation(conn, %{"id" => inv_id}) do
    with {:ok, _} <- Org.revoke_invitation(inv_id) do
      json(conn, %{ok: true})
    end
  end

  # POST /api/join/:token
  def join(conn, %{"token" => token} = params) do
    member_attrs = %{
      display_name: params["display_name"] || "New Member",
      email: params["email"],
      public_key: params["public_key"]
    }

    case Org.join_via_token(token, member_attrs) do
      {:ok, member} ->
        org = Org.get_org(member.organization_id)
        EmaWeb.Endpoint.broadcast("orgs:#{member.organization_id}", "member_joined", serialize_member(member))

        conn
        |> put_status(:created)
        |> json(%{member: serialize_member(member), org: serialize_org(org)})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: to_string(reason)})
    end
  end

  # DELETE /api/orgs/:id/members/:member_id
  def remove_member(conn, %{"id" => org_id, "member_id" => member_id}) do
    case Org.remove_member(org_id, member_id) do
      {:ok, _} ->
        EmaWeb.Endpoint.broadcast("orgs:#{org_id}", "member_removed", %{id: member_id})
        json(conn, %{ok: true})

      {:error, :not_found} ->
        {:error, :not_found}
    end
  end

  # PUT /api/orgs/:id/members/:member_id/role
  def update_role(conn, %{"id" => org_id, "member_id" => member_id} = params) do
    case Org.update_role(org_id, member_id, params["role"]) do
      {:ok, member} ->
        EmaWeb.Endpoint.broadcast("orgs:#{org_id}", "member_updated", serialize_member(member))
        json(conn, serialize_member(member))

      {:error, :not_found} ->
        {:error, :not_found}
    end
  end

  # GET /api/join/:token/preview
  def preview_invitation(conn, %{"token" => token}) do
    case Org.get_invitation_by_token(token) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "invalid_token"})

      inv ->
        case Ema.Org.Invitation.valid?(inv) do
          {:error, reason} ->
            conn |> put_status(:gone) |> json(%{error: to_string(reason)})

          :ok ->
            org = Org.get_org(inv.organization_id)

            json(conn, %{
              org_name: org.name,
              org_description: org.description,
              role: inv.role,
              expires_at: inv.expires_at
            })
        end
    end
  end

  # --- Helpers ---

  defp parse_expires_at(nil), do: nil

  defp parse_expires_at(str) when is_binary(str) do
    case DateTime.from_iso8601(str) do
      {:ok, dt, _} -> dt
      _ -> nil
    end
  end

  defp parse_expires_at(_), do: nil

  defp serialize_org(nil), do: nil

  defp serialize_org(org) do
    %{
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      avatar_url: org.avatar_url,
      owner_id: org.owner_id,
      settings: org.settings,
      created_at: org.inserted_at,
      updated_at: org.updated_at
    }
  end

  defp serialize_member(member) do
    %{
      id: member.id,
      organization_id: member.organization_id,
      display_name: member.display_name,
      email: member.email,
      role: member.role,
      public_key: member.public_key,
      status: member.status,
      joined_at: member.joined_at,
      last_seen_at: member.last_seen_at,
      created_at: member.inserted_at,
      updated_at: member.updated_at
    }
  end

  defp serialize_invitation(inv) do
    %{
      id: inv.id,
      organization_id: inv.organization_id,
      token: inv.token,
      role: inv.role,
      created_by: inv.created_by,
      expires_at: inv.expires_at,
      max_uses: inv.max_uses,
      use_count: inv.use_count,
      used_by: inv.used_by,
      revoked: inv.revoked,
      link: "ema://join/#{inv.token}",
      created_at: inv.inserted_at
    }
  end
end
