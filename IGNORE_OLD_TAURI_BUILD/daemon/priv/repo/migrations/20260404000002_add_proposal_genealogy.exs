defmodule Ema.Repo.Migrations.AddProposalGenealogy do
  use Ecto.Migration

  def change do
    alter table(:proposals) do
      add :generation, :integer, default: 0
      add :genealogy_path, :string
      add :validation_score, :float
      add :validation_gates_passed, :text
      add :validation_gates_failed, :text
      add :source_intent_id, :string
    end

    create index(:proposals, [:source_intent_id])
    create index(:proposals, [:generation])
  end
end
