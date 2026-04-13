defmodule Ema.Repo.Migrations.CreateSessionStore do
  use Ecto.Migration

  def change do
    create table(:session_store, primary_key: false) do
      add :session_id, :string, primary_key: true
      add :dcc_data, :text, null: false
      add :crystallized, :boolean, default: false

      timestamps()
    end

    create index(:session_store, [:crystallized])
    create index(:session_store, [:updated_at])
  end
end
