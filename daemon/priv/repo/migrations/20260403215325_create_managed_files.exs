defmodule Ema.Repo.Migrations.CreateManagedFiles do
  use Ecto.Migration

  def change do
    create table(:managed_files, primary_key: false) do
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
  end
end
