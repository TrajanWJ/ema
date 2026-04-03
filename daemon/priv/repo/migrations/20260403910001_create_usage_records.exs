defmodule Ema.Repo.Migrations.CreateUsageRecords do
  use Ecto.Migration

  def change do
    create table(:usage_records, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :agent_id, :string, null: false
      add :task_type, :string, null: false
      add :model, :string, null: false
      add :tokens_in, :integer, default: 0
      add :tokens_out, :integer, default: 0
      add :cost_usd, :decimal, precision: 10, scale: 6, default: 0
      add :metadata, :map

      timestamps()
    end

    create index(:usage_records, [:agent_id])
    create index(:usage_records, [:task_type])
    create index(:usage_records, [:inserted_at])
  end
end
