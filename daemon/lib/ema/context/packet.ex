defmodule Ema.Context.Packet do
  @moduledoc """
  Common envelope for assembled EMA context packets.

  Every packet should carry:
  - packet family/type metadata
  - actor/surface/scope metadata
  - authority/sensitivity metadata
  - assembled sections
  - source references
  - trace metadata
  """

  @enforce_keys [:packet_type, :mode, :scope, :sections]
  defstruct [
    :id,
    :packet_type,
    :mode,
    :scope,
    :actor_id,
    :actor_type,
    :surface,
    :session_id,
    :project_id,
    :intent_id,
    :execution_id,
    :authority_level,
    :sensitivity,
    :generated_at,
    :trace_id,
    sections: %{},
    sources: [],
    metadata: %{}
  ]

  def new(packet_type, attrs \\ %{}) do
    struct!(__MODULE__, Map.merge(%{
      id: generate_id(),
      packet_type: packet_type,
      generated_at: DateTime.utc_now(),
      sections: %{},
      sources: [],
      metadata: %{}
    }, attrs))
  end

  def put_section(%__MODULE__{} = packet, key, value) do
    %{packet | sections: Map.put(packet.sections, key, value)}
  end

  def add_source(%__MODULE__{} = packet, source) when is_map(source) do
    %{packet | sources: packet.sources ++ [source]}
  end

  defp generate_id do
    "pkt_" <> Integer.to_string(System.system_time(:millisecond)) <> "_" <>
      (:crypto.strong_rand_bytes(3) |> Base.encode16(case: :lower))
  end
end
