defmodule Ema.Agents.TelegramChannel do
  @moduledoc """
  Stub for Telegram channel integration.

  When implemented, this GenServer will:
  - Connect to Telegram Bot API via long-polling or webhook
  - Listen for messages from configured chats
  - Forward messages to AgentWorker
  - Send agent responses back to Telegram

  Requires external dependency (e.g., ex_gram) to be added to mix.exs.

  Config shape:
    %{
      "bot_token" => "...",
      "allowed_chat_ids" => ["..."]
    }
  """

  use GenServer
  require Logger

  def start_link({agent_id, channel_config}) do
    GenServer.start_link(__MODULE__, {agent_id, channel_config})
  end

  @impl true
  def init({agent_id, channel_config}) do
    Logger.info("TelegramChannel stub started for agent #{agent_id}")

    {:ok,
     %{
       agent_id: agent_id,
       config: channel_config,
       status: :disconnected
     }}
  end

  @impl true
  def handle_info(:connect, state) do
    Logger.warning("TelegramChannel: connect not implemented")
    {:noreply, state}
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply, state.status, state}
  end
end
