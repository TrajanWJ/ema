defmodule Ema.Repo.Migrations.CreateProposalTags do
  use Ecto.Migration

  def change do
    create table(:proposal_tags, primary_key: false) do
      add :id, :string, primary_key: true
      add :category, :string, null: false
      add :label, :string, null: false
      add :proposal_id, references(:proposals, type: :string, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:proposal_tags, [:proposal_id])
    create index(:proposal_tags, [:category])
  end
end
