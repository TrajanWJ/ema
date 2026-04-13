defmodule Ema.Team.TeamMember do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "team_members" do
    field :name, :string
    field :capacity_hours, :float, default: 40.0
    field :current_load, :float, default: 0.0
    field :skills, :map, default: %{"items" => []}
    field :availability_status, :string, default: "available"

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(available busy away offline)

  def changeset(member, attrs) do
    member
    |> cast(attrs, [:id, :name, :capacity_hours, :current_load, :skills, :availability_status])
    |> validate_required([:id, :name])
    |> validate_inclusion(:availability_status, @valid_statuses)
    |> validate_number(:capacity_hours, greater_than_or_equal_to: 0)
    |> validate_number(:current_load, greater_than_or_equal_to: 0)
  end
end
