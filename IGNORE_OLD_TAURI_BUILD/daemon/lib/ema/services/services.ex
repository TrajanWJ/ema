defmodule Ema.Services do
  @moduledoc "Self-hosted service management — register, start, stop, health-check."

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Services.ManagedService

  def list_services do
    ManagedService |> order_by(asc: :name) |> Repo.all()
  end

  def get_service(id), do: Repo.get(ManagedService, id)

  def create_service(attrs) do
    id = generate_id()

    config =
      case Map.get(attrs, :config, Map.get(attrs, "config")) do
        map when is_map(map) -> Jason.encode!(map)
        str when is_binary(str) -> str
        _ -> "{}"
      end

    %ManagedService{}
    |> ManagedService.changeset(Map.merge(attrs, %{id: id, config: config}))
    |> Repo.insert()
  end

  def update_service(id, attrs) do
    case get_service(id) do
      nil -> {:error, :not_found}
      svc -> svc |> ManagedService.changeset(attrs) |> Repo.update()
    end
  end

  def delete_service(id) do
    case get_service(id) do
      nil -> {:error, :not_found}
      svc -> Repo.delete(svc)
    end
  end

  def start_service(id) do
    update_service(id, %{status: "running"})
  end

  def stop_service(id) do
    update_service(id, %{status: "stopped"})
  end

  def restart_service(id) do
    with {:ok, _} <- update_service(id, %{status: "starting"}) do
      update_service(id, %{status: "running"})
    end
  end

  def serialize(svc) do
    %{
      id: svc.id,
      name: svc.name,
      type: svc.type,
      command: svc.command,
      port: svc.port,
      health_url: svc.health_url,
      status: svc.status,
      auto_start: svc.auto_start,
      config: svc.config,
      created_at: svc.inserted_at,
      updated_at: svc.updated_at
    }
  end

  defp generate_id do
    ts = System.system_time(:millisecond) |> Integer.to_string()
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "svc_#{ts}_#{rand}"
  end
end
