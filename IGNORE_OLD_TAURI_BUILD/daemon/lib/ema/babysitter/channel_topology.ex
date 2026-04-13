defmodule Ema.Babysitter.ChannelTopology do
  @moduledoc """
  Canonical babysitter/Discord channel topology.

  This is the single source of truth for:

  - logical babysitter streams and their Discord channel bindings
  - which streams are actively scheduled vs intentionally dormant
  - which non-stream Discord channels are delivery-only registrations
  - which control topics are internal-only and never map to a Discord channel

  Outbound babysitter publishing uses this topology together with
  `Ema.Babysitter.TickPolicy` and `Ema.Feedback.DiscordDelivery`.
  """

  @stream_category "STREAM OF CONSCIOUSNESS"

  @streams [
    %{
      stream: :live,
      channel_name: "babysitter-live",
      channel_id: "1489786483970936933",
      driver: Ema.Babysitter.StreamTicker,
      status: :active,
      category: @stream_category,
      purpose: "Primary operator-facing stream-of-consciousness summary"
    },
    %{
      stream: :heartbeat,
      channel_name: "system-heartbeat",
      channel_id: "1489820670333423827",
      driver: Ema.Babysitter.StreamChannels,
      status: :active,
      category: @stream_category,
      purpose: "VM health, DB access, queue depth, and latency snapshots"
    },
    %{
      stream: :intent,
      channel_name: "intent-stream",
      channel_id: "1489820673760301156",
      driver: Ema.Babysitter.StreamChannels,
      status: :active,
      category: @stream_category,
      purpose: "Intent and routing activity"
    },
    %{
      stream: :pipeline,
      channel_name: "pipeline-flow",
      channel_id: "1489820676859756606",
      driver: Ema.Babysitter.StreamChannels,
      status: :active,
      category: @stream_category,
      purpose: "Proposal, pipe-run, and execution flow changes"
    },
    %{
      stream: :agent,
      channel_name: "agent-thoughts",
      channel_id: "1489820679472677044",
      driver: Ema.Babysitter.StreamChannels,
      status: :active,
      category: @stream_category,
      purpose: "Claude session activity and summaries"
    },
    %{
      stream: :intelligence,
      channel_name: "intelligence-layer",
      channel_id: "1489820682198974525",
      driver: Ema.Babysitter.StreamChannels,
      status: :active,
      category: @stream_category,
      purpose: "Routing, bandit, and scope-advisor signals"
    },
    %{
      stream: :memory,
      channel_name: "memory-writes",
      channel_id: "1489820685101699193",
      driver: Ema.Babysitter.StreamChannels,
      status: :active,
      category: @stream_category,
      purpose: "Second Brain and memory write activity"
    },
    %{
      stream: :execution,
      channel_name: "execution-log",
      channel_id: "1489820687563493408",
      driver: Ema.Babysitter.StreamChannels,
      status: :active,
      category: @stream_category,
      purpose: "Active and recently completed execution work"
    },
    %{
      stream: :evolution,
      channel_name: "evolution-signals",
      channel_id: "1489820691074387979",
      driver: Ema.Babysitter.StreamChannels,
      status: :active,
      category: @stream_category,
      purpose: "Evolution and self-improvement signals"
    },
    %{
      stream: :speculative,
      channel_name: "speculative-feed",
      channel_id: "1489820693758607370",
      driver: Ema.Babysitter.StreamChannels,
      status: :dormant,
      category: @stream_category,
      purpose: "Synthetic parity feed kept registered but not auto-scheduled"
    }
  ]

  @delivery_only_channels [
    %{
      channel_name: "critical-blockers-track",
      channel_id: "1489751362211282954",
      status: :delivery_only,
      category: "ACTIVE SPRINT",
      purpose: "Manual or non-babysitter delivery target"
    },
    %{
      channel_name: "core-loop-implementation",
      channel_id: "1489751362215608441",
      status: :delivery_only,
      category: "ACTIVE SPRINT",
      purpose: "Manual or non-babysitter delivery target"
    },
    %{
      channel_name: "intelligence-integrations",
      channel_id: "1489751362613805317",
      status: :delivery_only,
      category: "ACTIVE SPRINT",
      purpose: "Manual or non-babysitter delivery target"
    },
    %{
      channel_name: "deliberation",
      channel_id: "1485847116227280966",
      status: :delivery_only,
      category: "ACTIVE SPRINT",
      purpose: "Manual or non-babysitter delivery target"
    },
    %{
      channel_name: "prompt-lab",
      channel_id: "1485847117078724629",
      status: :delivery_only,
      category: "ACTIVE SPRINT",
      purpose: "Manual or non-babysitter delivery target"
    },
    %{
      channel_name: "research-feed",
      channel_id: "1482258431997116531",
      status: :delivery_only,
      category: "FEEDS",
      purpose: "Manual or non-babysitter delivery target"
    },
    %{
      channel_name: "code-output",
      channel_id: "1484014829156175893",
      status: :delivery_only,
      category: "FEEDS",
      purpose: "Manual or non-babysitter delivery target"
    },
    %{
      channel_name: "alerts",
      channel_id: "1484031239680823316",
      status: :delivery_only,
      category: "FEEDS",
      purpose: "Manual or non-babysitter delivery target"
    },
    %{
      channel_name: "ops-log",
      channel_id: "1482256984811114688",
      status: :delivery_only,
      category: "FEEDS",
      purpose: "Manual or non-babysitter delivery target"
    }
  ]

  @control_topics [
    %{
      topic: "babysitter:control",
      status: :control,
      purpose: "Internal-only control signal stream consumed by VisibilityHub and tick policy"
    }
  ]

  def stream_category, do: @stream_category
  def streams, do: @streams
  def active_streams, do: Enum.filter(@streams, &(&1.status == :active))
  def dormant_streams, do: Enum.filter(@streams, &(&1.status == :dormant))
  def scheduled_streams, do: active_streams()
  def delivery_only_channels, do: @delivery_only_channels
  def control_topics, do: @control_topics

  def all_delivery_channels do
    (streams() ++ delivery_only_channels())
    |> Enum.map(&{&1.channel_id, &1.channel_name})
  end

  def stream!(stream) when is_atom(stream) do
    Enum.find(@streams, &(&1.stream == stream)) ||
      raise ArgumentError, "unknown babysitter stream: #{inspect(stream)}"
  end

  def live_stream, do: stream!(:live)

  def secondary_scheduled_streams do
    scheduled_streams()
    |> Enum.reject(&(&1.stream == :live))
  end

  def stream_channel_id(stream), do: stream!(stream).channel_id

  def stream_status(stream), do: stream!(stream).status

  def scheduled?(stream), do: stream_status(stream) == :active
end
