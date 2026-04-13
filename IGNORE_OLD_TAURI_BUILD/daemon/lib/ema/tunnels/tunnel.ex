defmodule Ema.Tunnels.Tunnel do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "tunnels" do
    field :provider, :string, default: "cloudflare"
    field :subdomain, :string
    field :public_url, :string
    field :status, :string, default: "stopped"
    field :config, :string, default: "{}"

    belongs_to :service, Ema.Services.ManagedService, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_providers ~w(cloudflare ngrok custom)
  @valid_statuses ~w(running stopped error starting)

  def changeset(tunnel, attrs) do
    tunnel
    |> cast(attrs, [:id, :service_id, :provider, :subdomain, :public_url, :status, :config])
    |> validate_required([:id, :provider])
    |> validate_inclusion(:provider, @valid_providers)
    |> validate_inclusion(:status, @valid_statuses)
    |> foreign_key_constraint(:service_id)
  end
end
