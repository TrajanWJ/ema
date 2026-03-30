defmodule Ema.Agents do
  @moduledoc """
  Agents context — CRUD for agents, channels, conversations, and messages.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Agents.{Agent, Channel, Conversation, Message}

  # --- ID generation ---

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end

  # === Agents ===

  def list_agents do
    Agent |> order_by(desc: :updated_at) |> Repo.all()
  end

  def list_active_agents do
    Agent |> where([a], a.status == "active") |> order_by(:name) |> Repo.all()
  end

  def get_agent(id), do: Repo.get(Agent, id)

  def get_agent_by_slug(slug) do
    Repo.get_by(Agent, slug: slug)
  end

  def get_agent_by_slug!(slug) do
    Repo.get_by!(Agent, slug: slug)
  end

  def create_agent(attrs) do
    id = generate_id("agent")

    %Agent{}
    |> Agent.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_agent(%Agent{} = agent, attrs) do
    agent
    |> Agent.changeset(attrs)
    |> Repo.update()
  end

  def delete_agent(%Agent{} = agent) do
    Repo.delete(agent)
  end

  # === Channels ===

  def list_channels_by_agent(agent_id) do
    Channel
    |> where([c], c.agent_id == ^agent_id)
    |> order_by(:channel_type)
    |> Repo.all()
  end

  def get_channel(id), do: Repo.get(Channel, id)

  def create_channel(attrs) do
    id = generate_id("ch")

    %Channel{}
    |> Channel.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_channel(%Channel{} = channel, attrs) do
    channel
    |> Channel.changeset(attrs)
    |> Repo.update()
  end

  def delete_channel(%Channel{} = channel) do
    Repo.delete(channel)
  end

  # === Conversations ===

  def list_conversations_by_agent(agent_id) do
    Conversation
    |> where([c], c.agent_id == ^agent_id)
    |> order_by(desc: :updated_at)
    |> Repo.all()
  end

  def get_conversation(id), do: Repo.get(Conversation, id)

  def get_conversation_with_messages(id) do
    Conversation
    |> Repo.get(id)
    |> case do
      nil -> nil
      conv -> Repo.preload(conv, messages: from(m in Message, order_by: m.inserted_at))
    end
  end

  def create_conversation(attrs) do
    id = generate_id("conv")

    %Conversation{}
    |> Conversation.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_conversation(%Conversation{} = conversation, attrs) do
    conversation
    |> Conversation.changeset(attrs)
    |> Repo.update()
  end

  def get_or_create_conversation(agent_id, channel_type, channel_id, external_user_id) do
    query =
      from c in Conversation,
        where:
          c.agent_id == ^agent_id and
            c.channel_type == ^channel_type and
            c.status == "active",
        where:
          (is_nil(^channel_id) and is_nil(c.channel_id)) or
            c.channel_id == ^channel_id,
        limit: 1

    case Repo.one(query) do
      nil ->
        create_conversation(%{
          agent_id: agent_id,
          channel_type: channel_type,
          channel_id: channel_id,
          external_user_id: external_user_id
        })

      conv ->
        {:ok, conv}
    end
  end

  # === Messages ===

  def list_messages_by_conversation(conversation_id) do
    Message
    |> where([m], m.conversation_id == ^conversation_id)
    |> order_by(:inserted_at)
    |> Repo.all()
  end

  def add_message(attrs) do
    id = generate_id("msg")

    %Message{}
    |> Message.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def count_messages(conversation_id) do
    Message
    |> where([m], m.conversation_id == ^conversation_id)
    |> Repo.aggregate(:count)
  end

  def delete_messages_before(conversation_id, %DateTime{} = before) do
    from(m in Message,
      where: m.conversation_id == ^conversation_id and m.inserted_at < ^before
    )
    |> Repo.delete_all()
  end
end
