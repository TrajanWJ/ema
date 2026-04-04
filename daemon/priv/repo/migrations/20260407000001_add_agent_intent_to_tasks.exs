defmodule Ema.Repo.Migrations.AddAgentIntentToTasks do
  use Ecto.Migration

  def change do
    alter table(:tasks) do
      add :agent, :string
      add :intent, :string
      add :intent_confidence, :string
      add :intent_overridden, :boolean, default: false
    end
  end
end
