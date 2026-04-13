defmodule Ema.Services.ManagedService do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "managed_services" do
    field :name, :string
    field :type, :string, default: "process"
    field :command, :string
    field :port, :integer
    field :health_url, :string
    field :status, :string, default: "stopped"
    field :auto_start, :boolean, default: false
    field :config, :string, default: "{}"

    has_many :tunnels, Ema.Tunnels.Tunnel, foreign_key: :service_id

    timestamps(type: :utc_datetime)
  end

  @valid_types ~w(docker systemd process)
  @valid_statuses ~w(running stopped error starting)

  def changeset(service, attrs) do
    service
    |> cast(attrs, [
      :id,
      :name,
      :type,
      :command,
      :port,
      :health_url,
      :status,
      :auto_start,
      :config
    ])
    |> validate_required([:id, :name, :type])
    |> validate_inclusion(:type, @valid_types)
    |> validate_inclusion(:status, @valid_statuses)
    |> unique_constraint(:name)
  end
end
