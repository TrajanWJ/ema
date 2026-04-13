defmodule Ema.Repo.Migrations.CreateManagedServices do
  use Ecto.Migration

  def change do
    create table(:managed_services, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :type, :string, null: false, default: "process"
      add :command, :string
      add :port, :integer
      add :health_url, :string
      add :status, :string, default: "stopped", null: false
      add :auto_start, :boolean, default: false
      add :config, :text, default: "{}"

      timestamps(type: :utc_datetime)
    end

    create unique_index(:managed_services, [:name])
    create index(:managed_services, [:status])
    create index(:managed_services, [:type])
  end
end
