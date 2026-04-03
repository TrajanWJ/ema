defmodule Ema.OpenClaw.Config do
  @moduledoc """
  Reads OpenClaw connection settings from application config and EMA settings store.
  """

  @defaults %{
    gateway_url: "http://localhost:5555",
    auth_token: nil,
    enabled: false
  }

  def gateway_url do
    get(:gateway_url) || @defaults.gateway_url
  end

  def auth_token do
    get(:auth_token) || @defaults.auth_token
  end

  def enabled? do
    get(:enabled) || @defaults.enabled
  end

  def ws_url do
    gateway_url()
    |> String.replace(~r{^http}, "ws")
    |> Kernel.<>("/ws")
  end

  defp get(key) do
    case Application.get_env(:ema, :openclaw) do
      nil -> Map.get(@defaults, key)
      config -> Keyword.get(config, key, Map.get(@defaults, key))
    end
  end
end
