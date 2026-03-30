defmodule Ema.Agents.DiscordChannel do
  @moduledoc """
  Stub for Discord channel integration.

  When implemented, this GenServer will:
  - Connect to Discord gateway via WebSocket using a bot token
  - Listen for messages in configured channels/guilds
  - Forward messages to AgentWorker
  - Send agent responses back to Discord

  Requires external dependency (e.g., nostrum) to be added to mix.exs.

  Config shape:
    %{
      "bot_token" => "...",
      "guild_id" => "...",
      "channel_ids" => ["..."]
    }
  """

  use GenServer
  require Logger

  def start_link({agent_id, channel_config}) do
    GenServer.start_link(__MODULE__, {agent_id, channel_config})
  end

  @impl true
  def init({agent_id, channel_config}) do
    Logger.info("DiscordChannel stub started for agent #{agent_id}")

    {:ok,
     %{
       agent_id: agent_id,
       config: channel_config,
       status: :disconnected
     }}
  end

  @impl true
  def handle_info(:connect, state) do
    Logger.warning("DiscordChannel: connect not implemented")
    {:noreply, state}
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply, state.status, state}
  end
end
