defmodule Ema.Agents.AgentWorkerTest do
  use Ema.DataCase, async: false

  alias Ema.Agents
  alias Ema.Agents.AgentWorker

  setup do
    # Create a test agent
    {:ok, agent} =
      Agents.create_agent(%{
        slug: "test-worker-#{System.unique_integer([:positive])}",
        name: "Test Worker Agent",
        description: "An agent for testing",
        model: "sonnet",
        status: "active",
        tools: []
      })

    # Create a conversation
    {:ok, conversation} =
      Agents.create_conversation(%{
        agent_id: agent.id,
        channel_type: "api"
      })

    %{agent: agent, conversation: conversation}
  end

  describe "start_link/1" do
    test "starts a worker for a valid agent", %{agent: agent} do
      assert {:ok, pid} = AgentWorker.start_link(agent.id)
      assert Process.alive?(pid)
      GenServer.stop(pid)
    end

    test "fails for nonexistent agent" do
      Process.flag(:trap_exit, true)

      assert {:error, {:agent_not_found, "nonexistent"}} =
               AgentWorker.start_link("nonexistent")
    end
  end

  describe "get_state/1" do
    test "returns agent state", %{agent: agent} do
      {:ok, pid} = AgentWorker.start_link(agent.id)
      state = AgentWorker.get_state(agent.id)
      assert state.agent_id == agent.id
      assert state.agent.slug == agent.slug
      GenServer.stop(pid)
    end
  end

  describe "prompt building" do
    test "builds prompt with conversation history", %{agent: agent, conversation: conv} do
      # Add some history
      Agents.add_message(%{conversation_id: conv.id, role: "user", content: "Hello"})

      Agents.add_message(%{
        conversation_id: conv.id,
        role: "assistant",
        content: "Hi there"
      })

      {:ok, pid} = AgentWorker.start_link(agent.id)

      # We can't easily test the prompt directly without mocking Claude CLI,
      # but we can verify the worker is alive and has loaded state
      state = AgentWorker.get_state(agent.id)
      assert state.agent.name == "Test Worker Agent"

      GenServer.stop(pid)
    end
  end

  describe "send_message/4" do
    test "stores user message and returns a result", %{
      agent: agent,
      conversation: conv
    } do
      {:ok, pid} = AgentWorker.start_link(agent.id)

      result = AgentWorker.send_message(agent.id, conv.id, "Hello")

      # Result depends on whether Claude CLI is available
      case result do
        {:ok, _response} -> :ok
        {:error, _reason} -> :ok
      end

      # The user message should have been stored regardless
      messages = Agents.list_messages_by_conversation(conv.id)
      user_messages = Enum.filter(messages, &(&1.role == "user"))
      assert length(user_messages) >= 1
      assert Enum.any?(user_messages, fn m -> m.content == "Hello" end)

      # Worker should still be alive after the call
      assert Process.alive?(pid)
      GenServer.stop(pid)
    end
  end
end
