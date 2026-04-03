defmodule Ema.Repo.Migrations.CreateMeetings do
  use Ecto.Migration

  def change do
    create table(:meetings, primary_key: false) do
      add :id, :string, primary_key: true
      add :title, :string, null: false
      add :description, :text
      add :starts_at, :utc_datetime
      add :ends_at, :utc_datetime
      add :attendees, :map, default: %{}
      add :location, :string
      add :project_id, :string
      add :notes, :text
      add :status, :string, default: "scheduled"
      timestamps(type: :utc_datetime)
    end
  end
end
