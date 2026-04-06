defmodule Ema.Babysitter.StreamTickerTest do
  use ExUnit.Case, async: true

  alias Ema.Babysitter.StreamTicker

  describe "delivery_decision/2" do
    test "first delivery always posts" do
      delivery = %{reason: "state changed", signature: %{git_sha: "abc"}, degraded_summary?: false}
      assert {:post, "state changed"} = StreamTicker.delivery_decision(nil, delivery)
    end

    test "skips when signature is unchanged" do
      sig = %{git_sha: "abc", tasks: [], proposals: []}
      last = %{signature: sig, degraded_summary?: false}
      delivery = %{signature: sig, degraded_summary?: false, reason: "state changed"}

      assert {:skip, "no state change"} = StreamTicker.delivery_decision(last, delivery)
    end

    test "posts when signature changes" do
      last = %{signature: %{git_sha: "abc"}, degraded_summary?: false}
      delivery = %{signature: %{git_sha: "def"}, degraded_summary?: false, reason: "state changed"}

      assert {:post, "state changed"} = StreamTicker.delivery_decision(last, delivery)
    end

    test "suppresses repeated degraded summaries with same signature" do
      sig = %{heartbeat: :degraded}
      last = %{signature: sig, degraded_summary?: true}
      delivery = %{signature: sig, degraded_summary?: true, reason: "heartbeat degraded"}

      assert {:skip, "repeated degraded summary"} = StreamTicker.delivery_decision(last, delivery)
    end

    test "posts degraded summary when signature changes" do
      last = %{signature: %{heartbeat: :degraded, procs: 100}, degraded_summary?: true}

      delivery = %{
        signature: %{heartbeat: :degraded, procs: 200},
        degraded_summary?: true,
        reason: "heartbeat degraded summary changed"
      }

      assert {:post, "heartbeat degraded summary changed"} =
               StreamTicker.delivery_decision(last, delivery)
    end
  end
end
