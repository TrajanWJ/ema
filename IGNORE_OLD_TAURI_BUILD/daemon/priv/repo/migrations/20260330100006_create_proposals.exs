defmodule Ema.Repo.Migrations.CreateProposals do
  use Ecto.Migration

  def change do
    create table(:proposals, primary_key: false) do
      add :id, :string, primary_key: true
      add :title, :string, null: false
      add :summary, :text
      add :body, :text
      add :status, :string, default: "queued"
      add :confidence, :float
      add :risks, :text, default: "[]"
      add :benefits, :text, default: "[]"
      add :estimated_scope, :string
      add :generation_log, :text, default: "{}"
      add :steelman, :text
      add :red_team, :text
      add :synthesis, :text
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)
      add :seed_id, references(:proposal_seeds, type: :string, on_delete: :nilify_all)
      add :parent_proposal_id, references(:proposals, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:proposals, [:status])
    create index(:proposals, [:project_id])
    create index(:proposals, [:seed_id])
  end
end
