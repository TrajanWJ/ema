defmodule Ema.Agents.AgentSupervisor do
  @moduledoc """
  Per-agent supervisor (one_for_one) that manages:
  - AgentWorker
  - AgentMemory
  - ChannelSupervisor (DynamicSupervisor for channel GenServers)
  """

  use Supervisor

  def start_link(agent_id) do
    Supervisor.start_link(__MODULE__, agent_id, name: via(agent_id))
  end

  defp via(agent_id) do
    {:via, Registry, {Ema.Agents.Registry, {:agent_sup, agent_id}}}
  end

  @impl true
  def init(agent_id) do
    children = [
      {Ema.Agents.AgentWorker, agent_id},
      {Ema.Agents.AgentMemory, agent_id},
      {DynamicSupervisor,
       name: {:via, Registry, {Ema.Agents.Registry, {:channel_sup, agent_id}}},
       strategy: :one_for_one}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end
