defmodule Ema.Repo.Migrations.CreateProjects do
  use Ecto.Migration

  def change do
    create table(:projects, primary_key: false) do
      add :id, :string, primary_key: true
      add :slug, :string, null: false
      add :name, :string, null: false
      add :description, :text
      add :status, :string, default: "incubating"
      add :icon, :string
      add :color, :string
      add :linked_path, :string
      add :context_hash, :string
      add :settings, :text, default: "{}"
      add :parent_id, references(:projects, type: :string, on_delete: :nilify_all)
      add :source_proposal_id, :string

      timestamps(type: :utc_datetime)
    end

    create unique_index(:projects, [:slug])
    create index(:projects, [:status])
    create index(:projects, [:parent_id])
  end
end
