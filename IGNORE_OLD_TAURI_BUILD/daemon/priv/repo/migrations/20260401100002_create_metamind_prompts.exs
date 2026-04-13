defmodule Ema.Repo.Migrations.CreateMetamindPrompts do
  use Ecto.Migration

  def change do
    create table(:metamind_prompts, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :body, :text, null: false
      add :category, :string, null: false
      add :tags, :text, default: "[]"
      add :version, :integer, default: 1
      add :effectiveness_score, :float, default: 0.0
      add :usage_count, :integer, default: 0
      add :success_count, :integer, default: 0
      add :metadata, :text, default: "{}"
      add :parent_id, :string
      add :template_vars, :text, default: "[]"

      timestamps(type: :utc_datetime)
    end

    create index(:metamind_prompts, [:category])
    create index(:metamind_prompts, [:effectiveness_score])
    create index(:metamind_prompts, [:parent_id])
  end
end
