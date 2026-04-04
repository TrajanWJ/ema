defmodule Ema.Repo.Migrations.AddOptimizerFieldsToPrompts do
  use Ecto.Migration

  def change do
    alter table(:prompts) do
      add :status, :string, null: false, default: "active"
      add :parent_prompt_id, :string
      add :control_prompt_id, :string
      add :optimizer_metadata, :map, null: false, default: %{}
    end

    create index(:prompts, [:status])
    create index(:prompts, [:parent_prompt_id])
    create index(:prompts, [:control_prompt_id])
    create index(:prompts, [:kind, :status])
  end
end
