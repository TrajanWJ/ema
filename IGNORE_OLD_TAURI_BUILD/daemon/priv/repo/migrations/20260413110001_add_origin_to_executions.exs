defmodule Ema.Repo.Migrations.AddOriginToExecutions do
  use Ecto.Migration

  def change do
    alter table(:executions) do
      add :origin, :string
    end

    create index(:executions, [:origin])
  end
end
