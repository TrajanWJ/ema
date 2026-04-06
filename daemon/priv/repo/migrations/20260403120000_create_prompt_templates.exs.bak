defmodule Ema.Repo.Migrations.CreatePromptTemplates do
  use Ecto.Migration

  def change do
    create table(:prompt_templates) do
      add :name, :string, null: false
      add :category, :string, null: false
      add :body, :text, null: false
      add :variables, :text, default: "[]"
      add :version, :integer, default: 1, null: false
      add :parent_id, references(:prompt_templates, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:prompt_templates, [:category])
    create index(:prompt_templates, [:parent_id])
  end
end
