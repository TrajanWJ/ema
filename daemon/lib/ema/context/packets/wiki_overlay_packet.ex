defmodule Ema.Context.Packets.WikiOverlayPacket do
  @moduledoc "Context-aware overlay packet for wiki or intent page augmentation."
  def packet_type, do: :wiki_overlay
end
