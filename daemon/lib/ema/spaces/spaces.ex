defmodule Ema.Spaces do
  @moduledoc """
  Context for Space management within Organizations.

  Spaces partition an org into isolated or federated AI contexts.
  Each space has an ai_privacy setting:
  - :isolated       — AI only sees data within this space
  - :federated_read — AI can read across all spaces in the org
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Spaces.{Space, Member}

  defp gen_id(prefix) do
    ts = System.system_time(:second)
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{ts}_#{rand}"
  end

  # --- Spaces ---

  def list_spaces do
    Space
    |> where([s], is_nil(s.archived_at))
    |> order_by([s], asc: s.inserted_at)
    |> Repo.all()
  end

  def list_spaces_for_org(org_id) do
    Space
    |> where([s], s.org_id == ^org_id and is_nil(s.archived_at))
    |> order_by([s], asc: s.inserted_at)
    |> Repo.all()
  end

  def get_space(id), do: Repo.get(Space, id)

  def get_space!(id), do: Repo.get!(Space, id)

  def create_space(attrs) do
    id = gen_id("spc")

    %Space{}
    |> Space.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_space(%Space{} = space, attrs) do
    space
    |> Space.changeset(attrs)
    |> Repo.update()
  end

  def archive_space(%Space{} = space) do
    space
    |> Space.changeset(%{archived_at: DateTime.utc_now()})
    |> Repo.update()
  end

  # --- Members ---

  def list_members(space_id) do
    Member
    |> where([m], m.space_id == ^space_id and is_nil(m.revoked_at))
    |> Repo.all()
  end

  def get_member_role(space_id, identity_id) do
    case Repo.get_by(Member, space_id: space_id, identity_id: identity_id) do
      %Member{role: role, revoked_at: nil} -> role
      _ -> nil
    end
  end

  def add_member(space_id, identity_id, role \\ "viewer") do
    id = gen_id("smbr")

    %Member{}
    |> Member.changeset(%{
      id: id,
      space_id: space_id,
      identity_id: identity_id,
      role: role,
      joined_at: DateTime.utc_now()
    })
    |> Repo.insert()
  end

  def remove_member(space_id, identity_id) do
    case Repo.get_by(Member, space_id: space_id, identity_id: identity_id) do
      nil ->
        {:error, :not_found}

      member ->
        member
        |> Member.changeset(%{revoked_at: DateTime.utc_now()})
        |> Repo.update()
    end
  end

  @doc """
  Creates a default 'Personal Space' for the given org + identity if none exists.
  Returns {:ok, space} — either existing or newly created.
  """
  def ensure_personal_space(org_id, identity_id) do
    case Repo.one(
           from s in Space,
             join: m in Member,
             on: m.space_id == s.id,
             where:
               s.org_id == ^org_id and
                 s.space_type == "personal" and
                 m.identity_id == ^identity_id and
                 is_nil(s.archived_at),
             limit: 1
         ) do
      %Space{} = space ->
        {:ok, space}

      nil ->
        Repo.transaction(fn ->
          {:ok, space} =
            create_space(%{
              org_id: org_id,
              name: "Personal Space",
              space_type: "personal",
              ai_privacy: "isolated",
              icon: "🏠"
            })

          {:ok, _} = add_member(space.id, identity_id, "owner")
          space
        end)
    end
  end
end
