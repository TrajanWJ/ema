defmodule Ema.Agents.Supervisor do
  @moduledoc """
  Top-level DynamicSupervisor for agents.
  Starts per-agent supervision subtrees for all active agents on init.
  """

  use DynamicSupervisor
  require Logger

  alias Ema.Agents

  def start_link(init_arg) do
    DynamicSupervisor.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  @impl true
  def init(_init_arg) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end

  @doc "Start an agent's supervision subtree."
  def start_agent(agent_id) do
    spec = {Ema.Agents.AgentSupervisor, agent_id}

    case DynamicSupervisor.start_child(__MODULE__, spec) do
      {:ok, pid} ->
        Logger.info("Started agent supervision tree for #{agent_id}")
        {:ok, pid}

      {:error, {:already_started, pid}} ->
        {:ok, pid}

      error ->
        Logger.error("Failed to start agent #{agent_id}: #{inspect(error)}")
        error
    end
  end

  @doc "Stop an agent's supervision subtree."
  def stop_agent(agent_id) do
    case Registry.lookup(Ema.Agents.Registry, {:agent_sup, agent_id}) do
      [{pid, _}] ->
        DynamicSupervisor.terminate_child(__MODULE__, pid)

      [] ->
        {:error, :not_running}
    end
  end

  @doc "Start all active agents. Called after application boot."
  def start_active_agents do
    agents = Agents.list_active_agents()
    Logger.info("Starting #{length(agents)} active agents")

    Enum.each(agents, fn agent ->
      start_agent(agent.id)
    end)
  end
end
