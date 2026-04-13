defmodule Ema.Repo.Migrations.CreateTunnels do
  use Ecto.Migration

  def change do
    create table(:tunnels, primary_key: false) do
      add :id, :string, primary_key: true
      add :service_id, references(:managed_services, type: :string, on_delete: :delete_all)
      add :provider, :string, null: false, default: "cloudflare"
      add :subdomain, :string
      add :public_url, :string
      add :status, :string, default: "stopped", null: false
      add :config, :text, default: "{}"

      timestamps(type: :utc_datetime)
    end

    create index(:tunnels, [:service_id])
    create index(:tunnels, [:status])
    create index(:tunnels, [:provider])
  end
end
