defmodule Place.Repo.Migrations.CreateFocus do
  use Ecto.Migration

  def change do
    create table(:focus_sessions, primary_key: false) do
      add :id, :string, primary_key: true
      add :started_at, :utc_datetime, null: false
      add :ended_at, :utc_datetime
      add :target_ms, :integer

      timestamps(type: :utc_datetime)
    end

    create table(:focus_blocks, primary_key: false) do
      add :id, :string, primary_key: true
      add :block_type, :string, null: false
      add :started_at, :utc_datetime, null: false
      add :ended_at, :utc_datetime
      add :elapsed_ms, :integer
      add :session_id, references(:focus_sessions, type: :string, on_delete: :delete_all)

      timestamps(type: :utc_datetime)
    end

    create index(:focus_blocks, [:session_id])
  end
end
