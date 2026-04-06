defmodule Ema.Repo.Migrations.CreateOrgInvitations do
  use Ecto.Migration

  def change do
    create table(:org_invitations, primary_key: false) do
      add :id, :string, primary_key: true

      add :organization_id, references(:organizations, type: :string, on_delete: :delete_all),
        null: false

      add :token, :string, null: false
      add :role, :string, null: false, default: "member"
      add :created_by, :string, null: false
      add :expires_at, :utc_datetime
      add :max_uses, :integer
      add :use_count, :integer, null: false, default: 0
      add :used_by, :text, default: "[]"
      add :revoked, :boolean, null: false, default: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:org_invitations, [:token])
    create index(:org_invitations, [:organization_id])
  end
end
