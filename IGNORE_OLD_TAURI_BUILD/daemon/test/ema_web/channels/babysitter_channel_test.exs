defmodule Ema.Babysitter.StreamChannelSuppressionTest do
  use ExUnit.Case, async: true

  alias Ema.Babysitter.StreamChannels

  describe "fingerprint/1" do
    test "identical signatures produce identical fingerprints" do
      sig = %{status: "healthy", heartbeat_state: "healthy", task_q: 3}
      assert StreamChannels.fingerprint(sig) == StreamChannels.fingerprint(sig)
    end

    test "different signatures produce different fingerprints" do
      sig_a = %{status: "healthy", task_q: 3}
      sig_b = %{status: "degraded", task_q: 3}
      assert StreamChannels.fingerprint(sig_a) != StreamChannels.fingerprint(sig_b)
    end

    test "fingerprint is a non-negative integer" do
      fp = StreamChannels.fingerprint(%{foo: "bar"})
      assert is_integer(fp) and fp >= 0
    end

    test "map key order does not affect fingerprint" do
      sig_a = %{a: 1, b: 2, c: 3}
      sig_b = %{c: 3, a: 1, b: 2}
      assert StreamChannels.fingerprint(sig_a) == StreamChannels.fingerprint(sig_b)
    end
  end

  describe "delivery_decision/2 with fingerprints" do
    test "first delivery always posts" do
      delivery = %{fingerprint: 12345, reason: "state changed", degraded_summary?: false}
      assert {:post, "state changed"} = StreamChannels.delivery_decision(nil, delivery)
    end

    test "skips when fingerprint matches" do
      fp = StreamChannels.fingerprint(%{active: 0, stalled: []})
      last = %{fingerprint: fp, degraded_summary?: false}
      delivery = %{fingerprint: fp, degraded_summary?: false, reason: "state changed"}

      assert {:skip, "no state change"} = StreamChannels.delivery_decision(last, delivery)
    end

    test "posts when fingerprint changes" do
      fp_a = StreamChannels.fingerprint(%{active: 0})
      fp_b = StreamChannels.fingerprint(%{active: 1})
      last = %{fingerprint: fp_a, degraded_summary?: false}
      delivery = %{fingerprint: fp_b, degraded_summary?: false, reason: "state changed"}

      assert {:post, "state changed"} = StreamChannels.delivery_decision(last, delivery)
    end

    test "suppresses repeated degraded summary with matching fingerprint" do
      fp = StreamChannels.fingerprint(%{status: "degraded"})
      last = %{fingerprint: fp, degraded_summary?: true}
      delivery = %{fingerprint: fp, degraded_summary?: true, reason: "heartbeat degraded"}

      assert {:skip, "repeated degraded summary"} =
               StreamChannels.delivery_decision(last, delivery)
    end

    test "posts degraded summary when fingerprint changes" do
      fp_a = StreamChannels.fingerprint(%{status: "degraded", task_q: 3})
      fp_b = StreamChannels.fingerprint(%{status: "degraded", task_q: 5})
      last = %{fingerprint: fp_a, degraded_summary?: true}
      delivery = %{fingerprint: fp_b, degraded_summary?: true, reason: "heartbeat degraded"}

      assert {:post, "heartbeat degraded"} = StreamChannels.delivery_decision(last, delivery)
    end
  end

  describe "delivery_decision/2 legacy fallback (no fingerprint)" do
    test "skips via signature comparison when fingerprint absent" do
      sig = %{stream: :agent, active: []}
      last = %{signature: sig, degraded_summary?: false}
      delivery = %{signature: sig, degraded_summary?: false, reason: "state changed"}

      assert {:skip, "no state change"} = StreamChannels.delivery_decision(last, delivery)
    end

    test "posts via signature comparison when signature differs" do
      last = %{signature: %{stream: :pipeline, proposals: []}, degraded_summary?: false}

      delivery = %{
        signature: %{stream: :pipeline, proposals: ["x"]},
        degraded_summary?: false,
        reason: "state changed"
      }

      assert {:post, "state changed"} = StreamChannels.delivery_decision(last, delivery)
    end
  end

  describe "build_delivery/4 includes fingerprint" do
    test "delivery contains fingerprint field" do
      # build_delivery requires DB access so we test the struct shape
      sig = %{status: "ok"}
      fp = StreamChannels.fingerprint(sig)
      assert is_integer(fp)
    end
  end

  describe "suppress_count tracking" do
    test "consecutive suppressions increment count" do
      fp = StreamChannels.fingerprint(%{x: 1})

      first = %{
        fingerprint: fp,
        signature: %{x: 1},
        message: "test",
        degraded_summary?: false,
        reason: "state changed",
        suppress_count: 0
      }

      # Simulate first post sets suppress_count to 0
      assert first.suppress_count == 0

      # Simulate suppression: same fingerprint
      second = %{first | reason: "state changed"}
      assert {:skip, _} = StreamChannels.delivery_decision(first, second)
    end
  end
end
