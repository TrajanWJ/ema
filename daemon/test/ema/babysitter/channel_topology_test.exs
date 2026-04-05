defmodule Ema.Babysitter.ChannelTopologyTest do
  use ExUnit.Case, async: false

  alias Ema.Babysitter.{ChannelTopology, StreamChannels, StreamTicker}
  alias Ema.Feedback.DiscordDelivery

  test "topology exposes one live stream and keeps speculative feed dormant" do
    live = ChannelTopology.live_stream()
    dormant = ChannelTopology.dormant_streams()

    assert live.stream == :live
    assert live.channel_name == "babysitter-live"
    assert live.driver == Ema.Babysitter.StreamTicker

    assert [%{stream: :speculative, channel_name: "speculative-feed", status: :dormant}] = dormant
  end

  test "stream channel scheduler only tracks active secondary streams" do
    scheduled_streams =
      StreamChannels.status()
      |> Enum.map(&String.to_existing_atom(&1.stream))
      |> Enum.sort()

    expected_streams =
      ChannelTopology.secondary_scheduled_streams()
      |> Enum.map(& &1.stream)
      |> Enum.sort()

    refute :speculative in scheduled_streams
    assert scheduled_streams == expected_streams

    Enum.each(StreamChannels.status(), fn stream ->
      assert stream.status == "active"
      assert stream.runtime.stream == stream.stream
      assert stream.runtime.current_ms >= stream.runtime.min_ms
      assert stream.runtime.current_ms <= stream.runtime.max_ms
    end)
  end

  test "live ticker reports topology-backed runtime state" do
    config = StreamTicker.config()

    assert config.stream.stream == :live
    assert config.stream.status == :active
    assert config.runtime.stream == "live"
    assert config.runtime.current_ms == config.interval_ms
    assert config.tick_count >= 0
  end

  test "discord delivery seeds every configured delivery channel" do
    expected =
      ChannelTopology.all_delivery_channels()
      |> Enum.map(fn {channel_id, _name} -> channel_id end)
      |> MapSet.new()

    actual =
      wait_for(fn ->
        channels = DiscordDelivery.channels()

        if length(channels) >= MapSet.size(expected) do
          {:ok, MapSet.new(channels)}
        else
          :retry
        end
      end)

    assert MapSet.subset?(expected, actual)
  end

  defp wait_for(fun, attempts \\ 20)

  defp wait_for(fun, attempts) when attempts > 0 do
    case fun.() do
      {:ok, result} ->
        result

      :retry ->
        Process.sleep(25)
        wait_for(fun, attempts - 1)
    end
  end

  defp wait_for(_fun, 0), do: flunk("timed out waiting for delivery workers")
end
