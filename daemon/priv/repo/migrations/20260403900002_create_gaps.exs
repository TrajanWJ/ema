defmodule Ema.Repo.Migrations.CreateGaps do
  use Ecto.Migration

  def change do
    create table(:gaps, primary_key: false) do
      add :id, :string, primary_key: true
      add :source, :string, null: false
      add :gap_type, :string, null: false
      add :title, :string, null: false
      add :description, :text
      add :severity, :string, null: false, default: "medium"
      add :project_id, references(:projects, type: :string, on_delete: :nilify_all)
      add :file_path, :string
      add :line_number, :integer
      add :status, :string, null: false, default: "open"
      add :resolved_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:gaps, [:source])
    create index(:gaps, [:gap_type])
    create index(:gaps, [:severity])
    create index(:gaps, [:status])
    create index(:gaps, [:project_id])
  end
end
