defmodule Ema.Repo.Migrations.CreateVaultFiles do
  use Ecto.Migration

  def change do
    create table(:vault_files, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :path, :string, null: false
      add :size_bytes, :integer, null: false, default: 0
      add :mime_type, :string
      add :checksum_sha256, :string
      add :encrypted, :boolean, default: false
      add :uploaded_by, :string

      timestamps(type: :utc_datetime)
    end

    create unique_index(:vault_files, [:path])
    create index(:vault_files, [:checksum_sha256])
  end
end
