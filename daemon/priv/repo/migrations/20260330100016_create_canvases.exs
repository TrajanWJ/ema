defmodule Ema.Repo.Migrations.CreateCanvases do
  use Ecto.Migration

  def change do
    create table(:canvases, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :description, :text
      add :canvas_type, :string
      add :viewport, :text, default: "{}"
      add :settings, :text, default: "{}"
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:canvases, [:project_id])

    create table(:canvas_elements, primary_key: false) do
      add :id, :string, primary_key: true
      add :element_type, :string, null: false
      add :x, :float, default: 0.0
      add :y, :float, default: 0.0
      add :width, :float
      add :height, :float
      add :rotation, :float, default: 0.0
      add :z_index, :integer, default: 0
      add :locked, :boolean, default: false
      add :style, :text, default: "{}"
      add :text, :text
      add :points, :text, default: "[]"
      add :image_path, :string
      add :data_source, :string
      add :data_config, :text, default: "{}"
      add :chart_config, :text, default: "{}"
      add :refresh_interval, :integer
      add :group_id, :string
      add :canvas_id, references(:canvases, type: :string, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:canvas_elements, [:canvas_id])
    create index(:canvas_elements, [:element_type])
  end
end
