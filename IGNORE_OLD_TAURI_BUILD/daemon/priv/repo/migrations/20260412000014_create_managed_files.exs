defmodule Ema.Repo.Migrations.CreateManagedFiles do
  use Ecto.Migration

  def change do
    create_if_not_exists table(:managed_files, primary_key: false) do
      add :id, :string, primary_key: true
      add :filename, :string, null: false
      add :path, :string, null: false
      add :size_bytes, :integer
      add :mime_type, :string
      add :tags, :map, default: %{}
      add :project_id, :string
      add :uploaded_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists index(:managed_files, [:project_id])
    create_if_not_exists index(:managed_files, [:mime_type])
  end
end
