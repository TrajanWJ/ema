defmodule Ema.Repo.Migrations.CreateVaultIndex do
  use Ecto.Migration

  def change do
    create table(:vault_index, primary_key: false) do
      add :path, :string, primary_key: true
      add :title, :string
      add :tags, :string
      add :modified_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end
  end
end
