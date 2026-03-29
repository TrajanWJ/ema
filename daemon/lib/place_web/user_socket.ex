defmodule PlaceWeb.UserSocket do
  use Phoenix.Socket

  channel "dashboard:*", PlaceWeb.DashboardChannel
  channel "brain_dump:*", PlaceWeb.BrainDumpChannel
  channel "habits:*", PlaceWeb.HabitsChannel
  channel "journal:*", PlaceWeb.JournalChannel
  channel "settings:*", PlaceWeb.SettingsChannel

  @impl true
  def connect(_params, socket, _connect_info) do
    {:ok, socket}
  end

  @impl true
  def id(_socket), do: nil
end
