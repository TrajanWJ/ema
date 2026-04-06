defmodule EmaWeb.OrgChannel do
  use Phoenix.Channel

  alias Ema.Org

  @impl true
  def join("orgs:lobby", _payload, socket) do
    orgs = Org.list_orgs() |> Enum.map(&serialize_org/1)
    {:ok, %{orgs: orgs}, socket}
  end

  @impl true
  def join("orgs:" <> org_id, _payload, socket) do
    case Org.get_org(org_id) do
      nil ->
        {:error, %{reason: "not_found"}}

      org ->
        members = Org.list_members(org.id) |> Enum.map(&serialize_member/1)

        {:ok, %{org: serialize_org(org), members: members}, assign(socket, :org_id, org_id)}
    end
  end

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
      status: member.status,
      joined_at: member.joined_at,
      last_seen_at: member.last_seen_at
    }
  end
end
