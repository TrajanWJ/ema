defmodule Ema.Meetings.Meeting do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "meetings" do
    field :title, :string
    field :description, :string
    field :starts_at, :utc_datetime
    field :ends_at, :utc_datetime
    field :attendees, :map, default: %{}
    field :location, :string
    field :project_id, :string
    field :notes, :string
    field :status, :string, default: "scheduled"

    timestamps(type: :utc_datetime)
  end

  @valid_statuses ~w(scheduled completed cancelled)

  def changeset(meeting, attrs) do
    meeting
    |> cast(attrs, [
      :id,
      :title,
      :description,
      :starts_at,
      :ends_at,
      :attendees,
      :location,
      :project_id,
      :notes,
      :status
    ])
    |> validate_required([:id, :title, :starts_at])
    |> validate_inclusion(:status, @valid_statuses)
  end
end
