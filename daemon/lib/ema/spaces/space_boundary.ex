defmodule Ema.AI.SpaceBoundary do
  @moduledoc """
  Enforces AI context boundaries across spaces.

  Determines what data the AI can see when operating within a given space.
  Two modes:
  - isolated       — AI only sees data scoped to this space
  - federated_read — AI can read across all spaces in the same org
  """

  import Ecto.Query
  alias Ema.{Repo, Spaces}
  alias Ema.Spaces.Space

  @doc """
  Returns true if identity_id is an active member of space_id.
  """
  def can_access_space?(identity_id, space_id) do
    case Spaces.get_member_role(space_id, identity_id) do
      nil -> false
      _role -> true
    end
  end

  @doc """
  Returns a context map describing what the AI can access for this space.
  """
  def build_context(space_id) do
    space = Spaces.get_space!(space_id)

    base = %{
      space_id: space_id,
      space_name: space.name,
      ai_privacy: space.ai_privacy,
      scope: if(space.ai_privacy == "isolated", do: :isolated, else: :federated)
    }

    case space.ai_privacy do
      "federated_read" ->
        # Include all non-archived spaces in the same org
        peer_spaces =
          Space
          |> where([s], s.org_id == ^space.org_id and is_nil(s.archived_at) and s.id != ^space_id)
          |> Repo.all()
          |> Enum.map(& &1.id)

        Map.merge(base, %{
          org_id: space.org_id,
          peer_space_ids: peer_spaces
        })

      _ ->
        Map.put(base, :org_id, space.org_id)
    end
  end

  @doc """
  Returns all project IDs accessible from this space.
  """
  def accessible_project_ids(space_id) do
    context = build_context(space_id)

    space_ids = case context do
      %{peer_space_ids: peers} -> [space_id | peers]
      _ -> [space_id]
    end

    Repo.all(
      from p in Ema.Projects.Project,
        where: p.space_id in ^space_ids and p.status != "archived",
        select: p.id
    )
  end
end
