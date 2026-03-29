defmodule EmaWeb.UserSocket do
  use Phoenix.Socket

  channel "dashboard:*", EmaWeb.DashboardChannel
  channel "brain_dump:*", EmaWeb.BrainDumpChannel
  channel "habits:*", EmaWeb.HabitsChannel
  channel "journal:*", EmaWeb.JournalChannel
  channel "settings:*", EmaWeb.SettingsChannel

  @impl true
  def connect(_params, socket, _connect_info) do
    {:ok, socket}
  end

  @impl true
  def id(_socket), do: nil
end
