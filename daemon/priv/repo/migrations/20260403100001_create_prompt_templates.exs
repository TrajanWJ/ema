defmodule Ema.Repo.Migrations.CreatePromptTemplates do
  use Ecto.Migration

  def change do
    create table(:prompt_templates, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :category, :string, null: false, default: "custom"
      add :body, :text, null: false, default: ""
      add :variables, :text, default: "[]"
      add :version, :integer, default: 1
      add :parent_id, :string

      timestamps(type: :utc_datetime)
    end

    create index(:prompt_templates, [:category])
    create index(:prompt_templates, [:parent_id])
    create index(:prompt_templates, [:name])
  end
end
