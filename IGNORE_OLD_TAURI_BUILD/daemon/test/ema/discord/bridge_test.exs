defmodule Ema.Discord.BridgeTest do
  use Ema.DataCase, async: false
  alias Ema.Discord.Bridge

  # These tests require the Voice subsystem to be running
  # Skip if voice is disabled in test env
  @moduletag :voice

  describe "receive_message/3" do
    test "returns a string response for any text input" do
      channel_id = "test_channel_#{System.unique_integer([:positive])}"
      {:ok, response} = Bridge.receive_message(channel_id, "user123", "hello")
      assert is_binary(response)
      assert String.length(response) > 0
    end

    test "handles command: create task" do
      channel_id = "test_channel_#{System.unique_integer([:positive])}"
      task_title = "Test task from Discord bridge #{System.unique_integer([:positive])}"
      {:ok, response} = Bridge.receive_message(channel_id, "user123", "create task #{task_title}")
      assert is_binary(response)
      # Task should have been created
      tasks = Ema.Tasks.list_tasks()
      assert Enum.any?(tasks, fn t -> t.title == task_title end)
    end

    test "handles brain dump command" do
      channel_id = "test_channel_#{System.unique_integer([:positive])}"
      content = "Remember to fix the login bug #{System.unique_integer([:positive])}"
      {:ok, response} = Bridge.receive_message(channel_id, "user123", "brain dump #{content}")
      assert is_binary(response)
    end

    test "two messages on same channel use same session" do
      channel_id = "test_channel_#{System.unique_integer([:positive])}"
      Bridge.receive_message(channel_id, "user123", "hello")
      session_id_1 = Bridge.session_id_for(channel_id)

      Bridge.receive_message(channel_id, "user123", "and another")
      session_id_2 = Bridge.session_id_for(channel_id)

      assert session_id_1 == session_id_2
      assert session_id_1 != nil
    end

    test "different channels get different sessions" do
      channel_a = "channel_a_#{System.unique_integer([:positive])}"
      channel_b = "channel_b_#{System.unique_integer([:positive])}"

      Bridge.receive_message(channel_a, "user1", "hello")
      Bridge.receive_message(channel_b, "user2", "hello")

      session_a = Bridge.session_id_for(channel_a)
      session_b = Bridge.session_id_for(channel_b)

      assert session_a != nil
      assert session_b != nil
      assert session_a != session_b
    end

    test "session_id contains the channel_id" do
      channel_id = "discord_#{System.unique_integer([:positive])}"
      Bridge.receive_message(channel_id, "user123", "test")
      session_id = Bridge.session_id_for(channel_id)
      assert String.contains?(session_id, channel_id)
    end
  end

  describe "clear_session/1" do
    test "clears a session so next message creates a new one" do
      channel_id = "test_channel_#{System.unique_integer([:positive])}"
      Bridge.receive_message(channel_id, "user123", "hello")
      session_id_before = Bridge.session_id_for(channel_id)

      Bridge.clear_session(channel_id)
      # Give async cast time to process
      Process.sleep(100)

      assert Bridge.session_id_for(channel_id) == nil

      # New message creates a fresh session
      Bridge.receive_message(channel_id, "user123", "hello again")
      session_id_after = Bridge.session_id_for(channel_id)
      assert session_id_after != session_id_before
    end
  end
end
