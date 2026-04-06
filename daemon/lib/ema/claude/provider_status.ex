defmodule Ema.Claude.ProviderStatus do
  @moduledoc """
  Read-model for exposing current provider execution state to API/UI consumers.
  """

  alias Ema.Claude.ProviderRegistry

  def execution_status(selected_provider_id \\ nil) do
    checked_at = DateTime.utc_now() |> DateTime.truncate(:second)

    case selected_provider(selected_provider_id) do
      nil ->
        %{
          selected_provider: nil,
          status: :missing_credentials,
          reason: :no_provider_configured,
          fallback_from: nil,
          checked_at: checked_at
        }

      provider ->
        health = adapter_health(provider)

        %{
          selected_provider: provider.id,
          status: map_status(provider, health),
          reason: reason_from(provider, health),
          fallback_from: fallback_from(provider, health),
          checked_at: checked_at
        }
    end
  end

  defp selected_provider(nil) do
    safe_list_available()
    |> List.first()
    |> case do
      nil -> safe_list() |> List.first()
      provider -> provider
    end
  end

  defp selected_provider(provider_id) when is_binary(provider_id) do
    case safe_get(provider_id) do
      {:ok, provider} -> provider
      _ -> selected_provider(nil)
    end
  end

  defp safe_get(provider_id) do
    ProviderRegistry.get(provider_id)
  catch
    :exit, _ -> {:error, :registry_unavailable}
  end

  defp safe_list_available do
    ProviderRegistry.list_available()
  catch
    :exit, _ -> []
  end

  defp safe_list do
    ProviderRegistry.list()
  catch
    :exit, _ -> []
  end

  defp adapter_health(provider) do
    adapter = provider.adapter_module || ProviderRegistry.adapter_for(provider.type)

    cond do
      is_nil(adapter) -> {:error, :no_adapter}
      function_exported?(adapter, :health_check, 0) -> adapter.health_check()
      true -> :ok
    end
  rescue
    e -> {:error, {:exception, Exception.message(e)}}
  end

  defp map_status(provider, health) do
    cond do
      auth_failed?(health) -> :auth_failed
      missing_credentials?(health) -> :missing_credentials
      provider.status in [:offline, :degraded, :rate_limited] -> :provider_unavailable
      health == :ok -> :healthy
      true -> :provider_unavailable
    end
  end

  defp reason_from(_provider, health) do
    cond do
      health == :ok -> nil
      is_tuple(health) and tuple_size(health) >= 2 -> elem(health, 1)
      true -> health
    end
  end

  defp fallback_from(_provider, _health) do
    nil
  end

  defp missing_credentials?(:ok), do: false

  defp missing_credentials?({:error, reason}),
    do:
      reason_text(reason) =~ "missing_api_key" or reason_text(reason) =~ "missing api key" or
        reason_text(reason) =~ "no_api_key"

  defp missing_credentials?(reason),
    do:
      reason_text(reason) =~ "missing_api_key" or reason_text(reason) =~ "missing api key" or
        reason_text(reason) =~ "no_api_key"

  defp auth_failed?(:ok), do: false
  defp auth_failed?({:error, reason}), do: auth_text?(reason_text(reason))
  defp auth_failed?(reason), do: auth_text?(reason_text(reason))

  defp auth_text?(text) do
    String.contains?(text, "invalid_api_key") or
      String.contains?(text, "invalid api key") or
      String.contains?(text, "401") or
      String.contains?(text, "unauthorized") or
      String.contains?(text, "oauth") or
      String.contains?(text, "auth")
  end

  defp reason_text(reason) do
    reason
    |> inspect()
    |> String.downcase()
  end
end
