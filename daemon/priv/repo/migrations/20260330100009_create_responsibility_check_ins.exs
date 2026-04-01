defmodule Ema.Repo.Migrations.CreateResponsibilityCheckIns do
  use Ecto.Migration

  def change do
    create table(:responsibility_check_ins, primary_key: false) do
      add :id, :string, primary_key: true
      add :status, :string, null: false
      add :note, :text

      add :responsibility_id,
          references(:responsibilities, type: :string, on_delete: :delete_all),
          null: false

      timestamps(type: :utc_datetime)
    end

    create index(:responsibility_check_ins, [:responsibility_id])
  end
end
