defmodule Ema.AgentsTest do
  use Ema.DataCase, async: false

  alias Ema.Agents

  # --- Helpers ---

  defp valid_agent_attrs(overrides \\ %{}) do
    slug = "test-agent-#{System.unique_integer([:positive])}"

    Map.merge(
      %{
        slug: slug,
        name: "Test Agent",
        description: "A test agent",
        model: "sonnet",
        temperature: 0.7,
        max_tokens: 4096,
        tools: ["brain_dump:create_item"],
        settings: %{"key" => "value"}
      },
      overrides
    )
  end

  defp create_agent!(overrides \\ %{}) do
    {:ok, agent} = Agents.create_agent(valid_agent_attrs(overrides))
    agent
  end

  # === Agent CRUD ===

  describe "create_agent/1" do
    test "creates an agent with valid attrs" do
      assert {:ok, agent} = Agents.create_agent(valid_agent_attrs())
      assert agent.name == "Test Agent"
      assert agent.model == "sonnet"
      assert agent.temperature == 0.7
      assert agent.status == "inactive"
      assert String.starts_with?(agent.id, "agent_")
    end

    test "fails without required fields" do
      assert {:error, changeset} = Agents.create_agent(%{})
      errors = errors_on(changeset)
      assert errors[:slug]
      assert errors[:name]
    end

    test "fails with duplicate slug" do
      agent = create_agent!()
      assert {:error, changeset} = Agents.create_agent(valid_agent_attrs(%{slug: agent.slug}))
      assert errors_on(changeset)[:slug]
    end

    test "fails with invalid status" do
      attrs = valid_agent_attrs(%{status: "bogus"})
      assert {:error, changeset} = Agents.create_agent(attrs)
      assert errors_on(changeset)[:status]
    end

    test "fails with invalid model" do
      attrs = valid_agent_attrs(%{model: "gpt-4"})
      assert {:error, changeset} = Agents.create_agent(attrs)
      assert errors_on(changeset)[:model]
    end
  end

  describe "list_agents/0" do
    test "returns all agents" do
      create_agent!(%{slug: "a1"})
      create_agent!(%{slug: "a2"})
      assert length(Agents.list_agents()) == 2
    end
  end

  describe "list_active_agents/0" do
    test "returns only active agents" do
      create_agent!(%{slug: "active-one", status: "active"})
      create_agent!(%{slug: "inactive-one", status: "inactive"})
      agents = Agents.list_active_agents()
      assert length(agents) == 1
      assert hd(agents).slug == "active-one"
    end
  end

  describe "get_agent_by_slug/1" do
    test "returns agent by slug" do
      agent = create_agent!()
      found = Agents.get_agent_by_slug(agent.slug)
      assert found.id == agent.id
    end

    test "returns nil for missing slug" do
      assert Agents.get_agent_by_slug("nonexistent") == nil
    end
  end

  describe "update_agent/2" do
    test "updates agent fields" do
      agent = create_agent!()
      assert {:ok, updated} = Agents.update_agent(agent, %{name: "Updated Name", model: "opus"})
      assert updated.name == "Updated Name"
      assert updated.model == "opus"
    end
  end

  describe "delete_agent/1" do
    test "deletes an agent" do
      agent = create_agent!()
      assert {:ok, _} = Agents.delete_agent(agent)
      assert Agents.get_agent(agent.id) == nil
    end
  end

  # === Channel CRUD ===

  describe "create_channel/1" do
    test "creates a channel for an agent" do
      agent = create_agent!()

      attrs = %{
        agent_id: agent.id,
        channel_type: "webchat",
        config: %{"theme" => "dark"}
      }

      assert {:ok, channel} = Agents.create_channel(attrs)
      assert channel.channel_type == "webchat"
      assert channel.active == true
      assert channel.status == "disconnected"
      assert String.starts_with?(channel.id, "ch_")
    end

    test "fails with invalid channel_type" do
      agent = create_agent!()
      attrs = %{agent_id: agent.id, channel_type: "slack"}
      assert {:error, changeset} = Agents.create_channel(attrs)
      assert errors_on(changeset)[:channel_type]
    end
  end

  describe "list_channels_by_agent/1" do
    test "returns channels for an agent" do
      agent = create_agent!()
      Agents.create_channel(%{agent_id: agent.id, channel_type: "webchat"})
      Agents.create_channel(%{agent_id: agent.id, channel_type: "api"})
      assert length(Agents.list_channels_by_agent(agent.id)) == 2
    end
  end

  describe "delete_channel/1" do
    test "deletes a channel" do
      agent = create_agent!()
      {:ok, channel} = Agents.create_channel(%{agent_id: agent.id, channel_type: "webchat"})
      assert {:ok, _} = Agents.delete_channel(channel)
      assert Agents.get_channel(channel.id) == nil
    end
  end

  # === Conversation CRUD ===

  describe "create_conversation/1" do
    test "creates a conversation" do
      agent = create_agent!()

      attrs = %{
        agent_id: agent.id,
        channel_type: "webchat",
        channel_id: "webchat:test",
        external_user_id: "user1"
      }

      assert {:ok, conv} = Agents.create_conversation(attrs)
      assert conv.status == "active"
      assert String.starts_with?(conv.id, "conv_")
    end
  end

  describe "get_or_create_conversation/4" do
    test "creates new conversation when none exists" do
      agent = create_agent!()

      assert {:ok, conv} =
               Agents.get_or_create_conversation(agent.id, "webchat", "ch1", "user1")

      assert conv.channel_type == "webchat"
    end

    test "returns existing active conversation" do
      agent = create_agent!()

      {:ok, conv1} =
        Agents.get_or_create_conversation(agent.id, "webchat", "ch1", "user1")

      {:ok, conv2} =
        Agents.get_or_create_conversation(agent.id, "webchat", "ch1", "user1")

      assert conv1.id == conv2.id
    end
  end

  describe "list_conversations_by_agent/1" do
    test "returns conversations for an agent" do
      agent = create_agent!()
      Agents.create_conversation(%{agent_id: agent.id, channel_type: "webchat"})
      Agents.create_conversation(%{agent_id: agent.id, channel_type: "api"})
      assert length(Agents.list_conversations_by_agent(agent.id)) == 2
    end
  end

  # === Messages ===

  describe "add_message/1" do
    test "adds a message to a conversation" do
      agent = create_agent!()
      {:ok, conv} = Agents.create_conversation(%{agent_id: agent.id, channel_type: "webchat"})

      assert {:ok, msg} =
               Agents.add_message(%{
                 conversation_id: conv.id,
                 role: "user",
                 content: "Hello!"
               })

      assert msg.role == "user"
      assert msg.content == "Hello!"
      assert String.starts_with?(msg.id, "msg_")
    end

    test "fails with invalid role" do
      agent = create_agent!()
      {:ok, conv} = Agents.create_conversation(%{agent_id: agent.id, channel_type: "webchat"})

      assert {:error, changeset} =
               Agents.add_message(%{
                 conversation_id: conv.id,
                 role: "admin",
                 content: "test"
               })

      assert errors_on(changeset)[:role]
    end
  end

  describe "get_conversation_with_messages/1" do
    test "returns conversation with ordered messages" do
      agent = create_agent!()
      {:ok, conv} = Agents.create_conversation(%{agent_id: agent.id, channel_type: "webchat"})
      Agents.add_message(%{conversation_id: conv.id, role: "user", content: "First"})
      Agents.add_message(%{conversation_id: conv.id, role: "assistant", content: "Second"})

      result = Agents.get_conversation_with_messages(conv.id)
      assert length(result.messages) == 2
      assert hd(result.messages).content == "First"
    end
  end

  describe "count_messages/1" do
    test "returns message count" do
      agent = create_agent!()
      {:ok, conv} = Agents.create_conversation(%{agent_id: agent.id, channel_type: "webchat"})
      Agents.add_message(%{conversation_id: conv.id, role: "user", content: "One"})
      Agents.add_message(%{conversation_id: conv.id, role: "assistant", content: "Two"})
      assert Agents.count_messages(conv.id) == 2
    end
  end
end
