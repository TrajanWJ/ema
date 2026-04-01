defmodule Ema.Repo.Migrations.AddVectorScoresToProposals do
  use Ecto.Migration

  def change do
    alter table(:proposals) do
      add :embedding, :binary
      add :idea_score, :float
      add :prompt_quality_score, :float
      add :score_breakdown, :text, default: "{}"
    end
  end
end
