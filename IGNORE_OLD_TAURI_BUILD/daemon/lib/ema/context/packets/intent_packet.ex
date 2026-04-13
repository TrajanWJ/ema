defmodule Ema.Context.Packets.IntentPacket do
  @moduledoc "Intent-scoped packet for intent frame, bindings, blockers, and related knowledge."
  def packet_type, do: :intent
end
