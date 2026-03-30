defmodule Ema.Agents.AgentMemoryTest do
  use Ema.DataCase, async: false

  alias Ema.Agents
  alias Ema.Agents.AgentMemory

  setup do
    {:ok, agent} =
      Agents.create_agent(%{
        slug: "test-memory-#{System.unique_integer([:positive])}",
        name: "Memory Test Agent",
        model: "sonnet",
        status: "active"
      })

    {:ok, conversation} =
      Agents.create_conversation(%{
        agent_id: agent.id,
        channel_type: "webchat"
      })

    %{agent: agent, conversation: conversation}
  end

  describe "start_link/1" do
    test "starts memory GenServer", %{agent: agent} do
      assert {:ok, pid} = AgentMemory.start_link(agent.id)
      assert Process.alive?(pid)
      GenServer.stop(pid)
    end
  end

  describe "summarization trigger" do
    test "does not summarize when under threshold", %{agent: agent, conversation: conv} do
      {:ok, pid} = AgentMemory.start_link(agent.id)

      # Add 5 messages (under default threshold of 20)
      for i <- 1..5 do
        Agents.add_message(%{
          conversation_id: conv.id,
          role: if(rem(i, 2) == 0, do: "assistant", else: "user"),
          content: "Message #{i}"
        })
      end

      # Trigger check
      AgentMemory.check_conversation(agent.id, conv.id)

      # Allow async processing
      Process.sleep(100)

      # All messages should still be there (no summarization)
      messages = Agents.list_messages_by_conversation(conv.id)
      assert length(messages) == 5
      refute Enum.any?(messages, fn m -> m.role == "system" end)

      GenServer.stop(pid)
    end

    test "triggers summarization when over threshold", %{agent: agent, conversation: conv} do
      {:ok, pid} = AgentMemory.start_link(agent.id)

      # Add 25 messages (over default threshold of 20)
      for i <- 1..25 do
        Agents.add_message(%{
          conversation_id: conv.id,
          role: if(rem(i, 2) == 0, do: "assistant", else: "user"),
          content: "Message #{i}"
        })
      end

      assert Agents.count_messages(conv.id) == 25

      # Trigger check - this will attempt to summarize but Claude CLI
      # won't be available in test, so it should log a warning but not crash
      AgentMemory.check_conversation(agent.id, conv.id)

      # Allow async processing
      Process.sleep(200)

      # Memory GenServer should still be alive (it handles CLI failures gracefully)
      assert Process.alive?(pid)

      GenServer.stop(pid)
    end
  end

  describe "handle_info :check_conversation" do
    test "handles check_conversation info message", %{agent: agent, conversation: conv} do
      {:ok, pid} = AgentMemory.start_link(agent.id)

      # This should not crash the process
      send(pid, {:check_conversation, conv.id})
      Process.sleep(100)
      assert Process.alive?(pid)

      GenServer.stop(pid)
    end
  end
end
