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

  def default_agent do
    case Application.get_env(:ema, :openclaw) do
      nil -> System.get_env("OPENCLAW_DEFAULT_AGENT", "main")
      config -> Keyword.get(config, :default_agent, "main")
    end
  end

  def timeout do
    case Application.get_env(:ema, :openclaw) do
      nil -> String.to_integer(System.get_env("OPENCLAW_TIMEOUT", "120")) * 1000
      config -> Keyword.get(config, :timeout, 120) * 1000
    end
  end
end
