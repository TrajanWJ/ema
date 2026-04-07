defmodule EmaWeb.ProviderController do
  @moduledoc "REST API for AI provider management."

  use EmaWeb, :controller

  alias Ema.Claude.{ProviderRegistry, ProviderStatus}

  @doc "GET /api/providers — list all providers with execution status"
  def index(conn, _params) do
    providers = safe_list()
    execution = ProviderStatus.execution_status()

    json(conn, %{
      providers: Enum.map(providers, &serialize_provider/1),
      execution_status: execution
    })
  end

  @doc "GET /api/providers/:id — single provider detail"
  def show(conn, %{"id" => id}) do
    case safe_get(id) do
      {:ok, provider} ->
        execution = ProviderStatus.execution_status(id)
        json(conn, %{provider: serialize_provider(provider), execution_status: execution})

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "Provider not found"})

      {:error, :registry_unavailable} ->
        conn |> put_status(503) |> json(%{error: "Provider registry unavailable"})
    end
  end

  @doc "POST /api/providers/detect — trigger runtime discovery"
  def detect(conn, _params) do
    result =
      try do
        Ema.Claude.RuntimeBootstrap.build()
      rescue
        e -> {:error, Exception.message(e)}
      end

    case result do
      {:error, reason} ->
        conn |> put_status(500) |> json(%{status: "error", reason: reason})

      config when is_map(config) ->
        provider_count = length(Map.get(config, :providers, []))
        account_count = length(Map.get(config, :accounts, []))

        json(conn, %{
          status: "ok",
          detected: %{providers: provider_count, accounts: account_count}
        })
    end
  end

  @doc "POST /api/providers/:id/health — trigger health check for a provider"
  def health(conn, %{"id" => id}) do
    case safe_get(id) do
      {:ok, provider} ->
        health_result = run_health_check(provider)
        json(conn, %{provider_id: id, health: health_result})

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "Provider not found"})

      {:error, :registry_unavailable} ->
        conn |> put_status(503) |> json(%{error: "Provider registry unavailable"})
    end
  end

  # -- Private --

  defp safe_list do
    ProviderRegistry.list()
  catch
    :exit, _ -> []
  end

  defp safe_get(id) do
    ProviderRegistry.get(id)
  catch
    :exit, _ -> {:error, :registry_unavailable}
  end

  defp run_health_check(provider) do
    adapter = provider.adapter_module || ProviderRegistry.adapter_for(provider.type)

    cond do
      is_nil(adapter) ->
        %{status: "unknown", reason: "no_adapter"}

      function_exported?(adapter, :health_check, 0) ->
        start = System.monotonic_time(:millisecond)

        case adapter.health_check() do
          :ok ->
            latency = System.monotonic_time(:millisecond) - start
            %{status: "healthy", latency_ms: latency}

          {:error, reason} ->
            %{status: "unhealthy", reason: inspect(reason)}
        end

      true ->
        %{status: "unknown", reason: "adapter_missing_health_check"}
    end
  rescue
    e -> %{status: "error", reason: Exception.message(e)}
  end

  defp serialize_provider(provider) do
    %{
      id: provider.id,
      type: to_string(provider.type),
      name: provider.name,
      status: to_string(provider.status),
      capabilities: serialize_capabilities(provider.capabilities),
      accounts: length(provider.accounts || []),
      rate_limits: serialize_map(provider.rate_limits),
      cost_profile: serialize_map(provider.cost_profile),
      health: serialize_map(provider.health),
      registered_at: provider.registered_at,
      updated_at: provider.updated_at
    }
  end

  defp serialize_capabilities(caps) when is_map(caps) do
    Map.new(caps, fn {k, v} -> {to_string(k), v} end)
  end

  defp serialize_capabilities(_), do: %{}

  defp serialize_map(m) when is_map(m) do
    Map.new(m, fn {k, v} -> {to_string(k), v} end)
  end

  defp serialize_map(_), do: %{}
end
