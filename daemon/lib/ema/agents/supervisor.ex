defmodule Ema.Agents.Supervisor do
  @moduledoc """
  Top-level DynamicSupervisor for agents.
  Starts per-agent supervision subtrees for all active agents on init.
  """

  use DynamicSupervisor
  require Logger

  alias Ema.Agents
  alias Ema.Agents.{Channel, DiscordChannel, TelegramChannel}

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
        start_channels(agent_id)
        {:ok, pid}

      {:error, {:already_started, pid}} ->
        start_channels(agent_id)
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

  @doc "Start all active channel workers for an agent."
  def start_channels(agent_id) do
    agent_id
    |> Agents.list_channels_by_agent()
    |> Enum.filter(& &1.active)
    |> Enum.each(&start_channel(agent_id, &1))
  end

  defp start_channel(agent_id, %Channel{channel_type: "discord"} = channel) do
    start_channel_child(agent_id, {DiscordChannel, {agent_id, channel}}, channel)
  end

  defp start_channel(agent_id, %Channel{channel_type: "telegram"} = channel) do
    start_channel_child(agent_id, {TelegramChannel, {agent_id, channel}}, channel)
  end

  defp start_channel(_agent_id, %Channel{channel_type: channel_type}) do
    Logger.debug("Skipping passive channel type #{channel_type}")
    :ok
  end

  defp start_channel_child(agent_id, spec, channel) do
    case Registry.lookup(Ema.Agents.Registry, {:channel_sup, agent_id}) do
      [{channel_sup, _}] ->
        case DynamicSupervisor.start_child(channel_sup, spec) do
          {:ok, _pid} ->
            Logger.info("Started #{channel.channel_type} channel #{channel.id} for #{agent_id}")
            :ok

          {:error, {:already_started, _pid}} ->
            :ok

          {:error, {:already_present, _child}} ->
            :ok

          {:error, reason} ->
            Logger.error(
              "Failed to start #{channel.channel_type} channel #{channel.id} for #{agent_id}: #{inspect(reason)}"
            )

            {:error, reason}
        end

      [] ->
        Logger.warning("Channel supervisor not available for #{agent_id}")
        {:error, :channel_supervisor_not_found}
    end
  end
end
