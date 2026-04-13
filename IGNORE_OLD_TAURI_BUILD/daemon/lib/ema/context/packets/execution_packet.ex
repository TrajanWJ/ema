defmodule Ema.Context.Packets.ExecutionPacket do
  @moduledoc "Execution-scoped packet for lineage, state, recovery hints, and source context."
  def packet_type, do: :execution
end
