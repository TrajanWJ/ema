defmodule EmaWeb.AccessControl do
  @moduledoc false

  @default_token_source Application.get_env(:ema, :api_access_tokens, [])
  @default_origins Application.get_env(:ema, :api_allowed_origins)

  def configured_tokens do
    Application.get_env(:ema, :api_access_tokens, @default_token_source)
    |> List.wrap()
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.uniq()
  end

  def allowed_origins do
    Application.get_env(:ema, :api_allowed_origins, @default_origins)
    |> List.wrap()
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.uniq()
  end

  def token_allowed?(token) when is_binary(token) do
    normalized = String.trim(token)
    Enum.any?(configured_tokens(), &secure_compare?(normalized, &1))
  end

  def token_allowed?(_token), do: false

  def local_request?(%{remote_ip: remote_ip}), do: local_request?(remote_ip)
  def local_request?(ip) when is_tuple(ip), do: ip_loopback?(ip)
  def local_request?(_), do: false

  defp secure_compare?(candidate, expected) when byte_size(candidate) == byte_size(expected) do
    Plug.Crypto.secure_compare(candidate, expected)
  end

  defp secure_compare?(_, _), do: false

  defp ip_loopback?({127, 0, 0, 1}), do: true
  defp ip_loopback?({0, 0, 0, 0, 0, 0, 0, 1}), do: true
  defp ip_loopback?(ip) when is_tuple(ip) do
    ip_str = to_string(:inet.ntoa(ip))
    ip_str in ["::ffff:7f00:1", "::ffff:127.0.0.1", "::1"]
  rescue
    _ -> false
  end

  defp ip_loopback?(_), do: false
end
