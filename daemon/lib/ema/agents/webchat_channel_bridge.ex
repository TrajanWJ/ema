defmodule Ema.Agents.WebchatChannelBridge do
  @moduledoc """
  Bridges Phoenix channel messages to the AgentWorker.
  When a message arrives on `agents:chat:<slug>`, this module
  forwards it to the agent's worker GenServer and returns the response.
  """

  alias Ema.Agents
  alias Ema.Agents.AgentWorker

  @doc """
  Handle an incoming webchat message for an agent.
  Creates or retrieves a conversation, then forwards to AgentWorker.
  """
  def handle_message(agent_slug, content, metadata \\ %{}) do
    case Agents.get_agent_by_slug(agent_slug) do
      nil ->
        {:error, :agent_not_found}

      agent ->
        if agent.status != "active" do
          {:error, :agent_inactive}
        else
          external_user_id = Map.get(metadata, "user_id", "webchat_user")

          {:ok, conversation} =
            Agents.get_or_create_conversation(
              agent.id,
              "webchat",
              "webchat:#{agent_slug}",
              external_user_id
            )

          AgentWorker.send_message(agent.id, conversation.id, content, metadata)
        end
    end
  end
end
