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
    test "returns error when gateway is unreachable" do
      assert {:error, _reason} = OpenClaw.health_check()
    end
  end

  describe "parse_event/1" do
    test "parses text event" do
      raw = ~s({"type": "text", "text": "hello"})
      assert {:ok, %{type: :text_delta, content: "hello"}} = OpenClaw.parse_event(raw)
    end

    test "parses result event" do
      raw = ~s({"type": "result", "result": "done", "usage": {"input_tokens": 10, "output_tokens": 20}})
      assert {:ok, %{type: :message_stop, content: "done", usage: %{tokens_in: 10, tokens_out: 20}}} = OpenClaw.parse_event(raw)
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
end
