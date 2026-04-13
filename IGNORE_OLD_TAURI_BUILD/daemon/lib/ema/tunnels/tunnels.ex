defmodule Ema.Tunnels do
  @moduledoc "Tunnel management — expose local services via cloudflare/ngrok."

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Tunnels.Tunnel

  def list_tunnels do
    Tunnel
    |> order_by(desc: :inserted_at)
    |> Repo.all()
    |> Repo.preload(:service)
  end

  def get_tunnel(id) do
    case Repo.get(Tunnel, id) do
      nil -> nil
      tunnel -> Repo.preload(tunnel, :service)
    end
  end

  def create_tunnel(attrs) do
    id = generate_id()

    config =
      case Map.get(attrs, :config, Map.get(attrs, "config")) do
        map when is_map(map) -> Jason.encode!(map)
        str when is_binary(str) -> str
        _ -> "{}"
      end

    %Tunnel{}
    |> Tunnel.changeset(Map.merge(attrs, %{id: id, config: config}))
    |> Repo.insert()
  end

  def update_tunnel(id, attrs) do
    case Repo.get(Tunnel, id) do
      nil -> {:error, :not_found}
      tunnel -> tunnel |> Tunnel.changeset(attrs) |> Repo.update()
    end
  end

  def delete_tunnel(id) do
    case Repo.get(Tunnel, id) do
      nil -> {:error, :not_found}
      tunnel -> Repo.delete(tunnel)
    end
  end

  def serialize(tunnel) do
    %{
      id: tunnel.id,
      service_id: tunnel.service_id,
      service_name:
        if(Ecto.assoc_loaded?(tunnel.service) && tunnel.service, do: tunnel.service.name),
      provider: tunnel.provider,
      subdomain: tunnel.subdomain,
      public_url: tunnel.public_url,
      status: tunnel.status,
      config: tunnel.config,
      created_at: tunnel.inserted_at,
      updated_at: tunnel.updated_at
    }
  end

  defp generate_id do
    ts = System.system_time(:millisecond) |> Integer.to_string()
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "tnl_#{ts}_#{rand}"
  end
end
