defmodule EmaWeb.SettingsController do
  use EmaWeb, :controller

  alias Ema.Settings

  action_fallback EmaWeb.FallbackController

  def index(conn, _params) do
    json(conn, %{settings: Settings.all()})
  end

  def update(conn, %{"key" => key, "value" => value}) do
    with {:ok, setting} <- Settings.set(key, value) do
      EmaWeb.Endpoint.broadcast("settings:sync", "setting_updated", %{
        key: setting.key,
        value: setting.value
      })

      json(conn, %{key: setting.key, value: setting.value})
    end
  end
end
