defmodule Ema.Repo.Migrations.CreateCanvasTemplates do
  use Ecto.Migration

  def change do
    create table(:canvas_templates, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :description, :text
      add :category, :string, null: false, default: "general"
      add :layout_json, :text, null: false
      add :thumbnail, :string

      timestamps(type: :utc_datetime)
    end

    create index(:canvas_templates, [:category])
  end
end
