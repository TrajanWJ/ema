defmodule Ema.Babysitter.StreamChatterSuppressionTest do
  use ExUnit.Case, async: true

  alias Ema.Babysitter.{StreamChannels, StreamTicker}

  test "live ticker skips identical steady-state summaries" do
    last_delivery = %{signature: %{git_sha: "abc123"}, degraded_summary?: false}
    delivery = %{signature: %{git_sha: "abc123"}, degraded_summary?: false}

    assert {:skip, "no state change"} = StreamTicker.delivery_decision(last_delivery, delivery)
  end

  test "live ticker suppresses repeated degraded summaries" do
    last_delivery = %{signature: %{heartbeat: :degraded}, degraded_summary?: true}
    delivery = %{signature: %{heartbeat: :degraded}, degraded_summary?: true}

    assert {:skip, "repeated degraded summary"} =
             StreamTicker.delivery_decision(last_delivery, delivery)
  end

  test "live ticker posts when the fingerprint changes" do
    last_delivery = %{signature: %{git_sha: "abc123"}, degraded_summary?: false}

    delivery = %{
      signature: %{git_sha: "def456"},
      degraded_summary?: false,
      reason: "state changed"
    }

    assert {:post, "state changed"} = StreamTicker.delivery_decision(last_delivery, delivery)
  end

  test "secondary stream skips identical steady-state summaries" do
    last_delivery = %{signature: %{stream: :agent, active: []}, degraded_summary?: false}
    delivery = %{signature: %{stream: :agent, active: []}, degraded_summary?: false}

    assert {:skip, "no state change"} = StreamChannels.delivery_decision(last_delivery, delivery)
  end

  test "secondary stream suppresses repeated degraded heartbeat summaries" do
    last_delivery = %{signature: %{stream: :heartbeat, state: :degraded}, degraded_summary?: true}
    delivery = %{signature: %{stream: :heartbeat, state: :degraded}, degraded_summary?: true}

    assert {:skip, "repeated degraded summary"} =
             StreamChannels.delivery_decision(last_delivery, delivery)
  end

  test "secondary stream posts when the fingerprint changes" do
    last_delivery = %{signature: %{stream: :pipeline, proposals: []}, degraded_summary?: false}

    delivery = %{
      signature: %{stream: :pipeline, proposals: ["x"]},
      degraded_summary?: false,
      reason: "state changed"
    }

    assert {:post, "state changed"} = StreamChannels.delivery_decision(last_delivery, delivery)
  end
end
