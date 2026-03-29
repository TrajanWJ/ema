defmodule PlaceWeb.SettingsController do
  use PlaceWeb, :controller

  alias Place.Settings

  action_fallback PlaceWeb.FallbackController

  def index(conn, _params) do
    json(conn, %{settings: Settings.all()})
  end

  def update(conn, %{"key" => key, "value" => value}) do
    with {:ok, setting} <- Settings.set(key, value) do
      PlaceWeb.Endpoint.broadcast("settings:sync", "setting_updated", %{
        key: setting.key,
        value: setting.value
      })

      json(conn, %{key: setting.key, value: setting.value})
    end
  end
end
