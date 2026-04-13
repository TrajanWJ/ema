defmodule Ema.Repo.Migrations.CreateOrgMembers do
  use Ecto.Migration

  def change do
    create table(:org_members, primary_key: false) do
      add :id, :string, primary_key: true

      add :organization_id, references(:organizations, type: :string, on_delete: :delete_all),
        null: false

      add :display_name, :string, null: false
      add :email, :string
      add :role, :string, null: false, default: "member"
      add :public_key, :text
      add :status, :string, null: false, default: "active"
      add :joined_at, :utc_datetime
      add :last_seen_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:org_members, [:organization_id])
    create unique_index(:org_members, [:organization_id, :email])
  end
end
