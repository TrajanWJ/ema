defmodule Ema.Team do
  @moduledoc """
  Team context -- team members, availability, standups, and workload tracking.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Team.{TeamMember, Standup}

  # Team Members

  def list_members do
    TeamMember |> order_by(asc: :name) |> Repo.all()
  end

  def get_member(id), do: Repo.get(TeamMember, id)

  def create_member(attrs) do
    id = generate_id("tm")

    %TeamMember{}
    |> TeamMember.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_member(%TeamMember{} = member, attrs) do
    member
    |> TeamMember.changeset(attrs)
    |> Repo.update()
  end

  def delete_member(%TeamMember{} = member) do
    Repo.delete(member)
  end

  # Standups

  def list_standups_for_date(date) do
    Standup
    |> where([s], s.date == ^date)
    |> order_by(desc: :inserted_at)
    |> Repo.all()
  end

  def list_standups_for_member(member_id) do
    Standup
    |> where([s], s.member_id == ^member_id)
    |> order_by(desc: :date)
    |> limit(30)
    |> Repo.all()
  end

  def get_standup(id), do: Repo.get(Standup, id)

  def create_standup(attrs) do
    id = generate_id("su")

    %Standup{}
    |> Standup.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_standup(%Standup{} = standup, attrs) do
    standup
    |> Standup.changeset(attrs)
    |> Repo.update()
  end

  def delete_standup(%Standup{} = standup) do
    Repo.delete(standup)
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
