defmodule Ema.Services.Monitor do
  @moduledoc "Periodically health-checks registered managed services."
  use GenServer
  require Logger

  alias Ema.Services

  @check_interval :timer.seconds(30)

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    schedule_check()
    {:ok, %{}}
  end

  @impl true
  def handle_info(:check_health, state) do
    check_all_services()
    schedule_check()
    {:noreply, state}
  end

  defp check_all_services do
    Services.list_services()
    |> Enum.filter(&(&1.status == "running" and &1.health_url != nil))
    |> Enum.each(&check_service/1)
  end

  defp check_service(service) do
    case http_health_check(service.health_url) do
      :ok ->
        :ok

      :error ->
        Logger.warning("Service #{service.name} health check failed")
        Services.update_service(service.id, %{status: "error"})

        EmaWeb.Endpoint.broadcast(
          "services:lobby",
          "service_updated",
          Services.serialize(service)
        )
    end
  end

  defp http_health_check(nil), do: :ok

  defp http_health_check(url) do
    # Simple HTTP GET check — returns :ok if 2xx, :error otherwise
    case :httpc.request(:get, {String.to_charlist(url), []}, [{:timeout, 5000}], []) do
      {:ok, {{_, status, _}, _, _}} when status >= 200 and status < 300 -> :ok
      _ -> :error
    end
  rescue
    _ -> :error
  end

  defp schedule_check do
    Process.send_after(self(), :check_health, @check_interval)
  end
end
