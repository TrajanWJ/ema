defmodule Ema.Claude.Adapters.OpenClawTest do
  use ExUnit.Case, async: true

  alias Ema.Claude.Adapters.OpenClaw

  describe "capabilities/0" do
    test "returns expected capability map" do
      caps = OpenClaw.capabilities()
      assert caps.tool_use == true
      assert caps.agent_routing == true
      assert caps.streaming == false
      assert is_binary(caps.gateway_url)
    end
  end

  describe "health_check/0" do
    test "returns :ok or {:error, reason}" do
      result = OpenClaw.health_check()
      assert result == :ok or match?({:error, _}, result)
    end
  end

  describe "parse_event/1" do
    test "parses text event" do
      raw = ~s({"type": "text", "text": "hello"})
      assert {:ok, %{type: :text_delta, content: "hello"}} = OpenClaw.parse_event(raw)
    end

    test "parses result event" do
      raw =
        ~s({"type": "result", "result": "done", "usage": {"input_tokens": 10, "output_tokens": 20}})

      assert {:ok, %{type: :message_stop, content: "done", usage: %{tokens_in: 10, tokens_out: 20}}} =
               OpenClaw.parse_event(raw)
    end

    test "parses error event" do
      raw = ~s({"type": "error", "message": "boom"})
      assert {:error, %{message: "boom"}} = OpenClaw.parse_event(raw)
    end

    test "skips system events" do
      assert :skip = OpenClaw.parse_event(~s({"type": "system"}))
    end

    test "skips empty lines" do
      assert :skip = OpenClaw.parse_event("")
      assert :skip = OpenClaw.parse_event("   ")
    end

    test "skips unparseable JSON" do
      assert :skip = OpenClaw.parse_event("not json at all")
    end
  end

  describe "dispatch_ssh/3" do
    test "returns error when ssh not found" do
      # Temporarily override PATH to hide ssh
      original_path = System.get_env("PATH")
      System.put_env("PATH", "/nonexistent")

      result = OpenClaw.dispatch_ssh("test", "main", [])

      System.put_env("PATH", original_path)
      assert {:error, :ssh_not_found} = result
    end
  end

  describe "send_message/2" do
    test "returns not supported" do
      assert {:error, :not_supported_use_new_session} = OpenClaw.send_message(self(), "test")
    end
  end

  describe "stop_session/1" do
    test "handles non-port gracefully" do
      assert :ok = OpenClaw.stop_session(:not_a_port)
    end
  end
end
