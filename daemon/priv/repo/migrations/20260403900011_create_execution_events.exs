defmodule Ema.Repo.Migrations.CreateExecutionEvents do
  use Ecto.Migration

  def change do
    create table(:execution_events, primary_key: false) do
      add :id,           :string, primary_key: true
      add :execution_id, references(:executions, type: :string, on_delete: :delete_all), null: false
      add :type,         :string, null: false
      add :actor_kind,   :string, null: false, default: "system"
      add :payload,      :map, default: %{}
      add :at,           :utc_datetime, null: false
    end

    create index(:execution_events, [:execution_id])
    create index(:execution_events, [:type])
    create index(:execution_events, [:at])
  end
end
