defmodule EmaWeb.AgentLobbyChannel do
  @moduledoc """
  Phoenix channel for `agents:lobby` — broadcasts agent list and status updates.
  """

  use Phoenix.Channel

  alias Ema.Agents

  @impl true
  def join("agents:lobby", _payload, socket) do
    agents =
      Agents.list_agents()
      |> Enum.map(&serialize_agent/1)

    {:ok, %{agents: agents}, socket}
  end

  defp serialize_agent(agent) do
    %{
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      avatar: agent.avatar,
      status: agent.status,
      model: agent.model,
      created_at: agent.inserted_at,
      updated_at: agent.updated_at
    }
  end
end
