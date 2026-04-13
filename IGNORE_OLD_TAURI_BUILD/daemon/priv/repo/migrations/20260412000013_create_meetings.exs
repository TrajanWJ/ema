defmodule Ema.Repo.Migrations.CreateMeetings do
  use Ecto.Migration

  def change do
    create_if_not_exists table(:meetings, primary_key: false) do
      add :id, :string, primary_key: true
      add :title, :string, null: false
      add :description, :text
      add :starts_at, :utc_datetime, null: false
      add :ends_at, :utc_datetime
      add :attendees, :map, default: %{}
      add :location, :string
      add :project_id, :string
      add :notes, :text
      add :status, :string, default: "scheduled"

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists index(:meetings, [:project_id])
    create_if_not_exists index(:meetings, [:starts_at])
    create_if_not_exists index(:meetings, [:status])
  end
end
