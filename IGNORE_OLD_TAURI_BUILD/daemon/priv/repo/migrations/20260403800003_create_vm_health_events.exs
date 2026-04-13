defmodule Ema.Repo.Migrations.CreateVmHealthEvents do
  use Ecto.Migration

  def change do
    create table(:vm_health_events, primary_key: false) do
      add :id, :string, primary_key: true
      add :status, :string, null: false, default: "unknown"
      add :openclaw_up, :boolean, default: false
      add :ssh_up, :boolean, default: false
      add :containers_json, :text, default: "[]"
      add :latency_ms, :integer
      add :checked_at, :utc_datetime, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:vm_health_events, [:checked_at])
    create index(:vm_health_events, [:status])
  end
end
