defmodule EmaWeb.UserSocket do
  use Phoenix.Socket

  channel "dashboard:*", EmaWeb.DashboardChannel
  channel "brain_dump:*", EmaWeb.BrainDumpChannel
  channel "habits:*", EmaWeb.HabitsChannel
  channel "journal:*", EmaWeb.JournalChannel
  channel "settings:*", EmaWeb.SettingsChannel
  channel "workspace:*", EmaWeb.WorkspaceChannel
  channel "projects:*", EmaWeb.ProjectChannel
  channel "sessions:*", EmaWeb.SessionChannel
  channel "tasks:*", EmaWeb.TaskChannel
  channel "proposals:*", EmaWeb.ProposalChannel
  channel "vault:*", EmaWeb.VaultChannel
  channel "pipes:*", EmaWeb.PipesChannel
  channel "responsibilities:*", EmaWeb.ResponsibilityChannel
  channel "agents:lobby", EmaWeb.AgentLobbyChannel
  channel "agents:chat:*", EmaWeb.AgentChatChannel
  channel "canvas:*", EmaWeb.CanvasChannel

  @impl true
  def connect(_params, socket, _connect_info) do
    {:ok, socket}
  end

  @impl true
  def id(_socket), do: nil
end
