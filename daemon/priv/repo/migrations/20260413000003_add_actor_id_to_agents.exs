defmodule Ema.Repo.Migrations.AddActorIdToAgents do
  use Ecto.Migration

  def change do
    alter table(:agents) do
      add :actor_id, references(:actors, type: :string, on_delete: :nilify_all)
    end

    create index(:agents, [:actor_id])
  end
end
