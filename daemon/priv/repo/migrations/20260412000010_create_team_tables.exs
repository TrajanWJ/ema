defmodule Ema.Repo.Migrations.CreateTeamTables do
  use Ecto.Migration

  def change do
    create table(:team_members, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :capacity_hours, :float, default: 40.0
      add :current_load, :float, default: 0.0
      add :skills, :map, default: %{"items" => []}
      add :availability_status, :string, default: "available"

      timestamps(type: :utc_datetime)
    end

    create table(:standups, primary_key: false) do
      add :id, :string, primary_key: true
      add :member_id, :string
      add :date, :date
      add :yesterday, :string
      add :today, :string
      add :blockers, :string
      add :mood, :integer, default: 3

      timestamps(type: :utc_datetime)
    end

    create index(:standups, [:member_id])
    create index(:standups, [:date])
  end
end
