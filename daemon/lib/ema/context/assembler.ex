defmodule Ema.Context.Assembler do
  @moduledoc """
  Initial context assembler skeleton.
  """

  alias Ema.Context.{Packet, Security}
  alias Ema.Context.Adapters.{RuntimeAdapter, MemoryAdapter, LoopsAdapter, IntentAdapter}

  @default_adapters [RuntimeAdapter, IntentAdapter, MemoryAdapter, LoopsAdapter]

  def assemble(packet_type, opts \\ []) do
    items =
      @default_adapters
      |> Enum.flat_map(& &1.fetch(opts))
      |> Security.filter_items(
        sensitivity_ceiling: Keyword.get(opts, :sensitivity_ceiling, :internal),
        actor_type: Keyword.get(opts, :actor_type),
        surface: Keyword.get(opts, :surface)
      )

    Packet.new(packet_type, %{
      mode: Keyword.get(opts, :mode, :status),
      scope: %{
        actor_id: Keyword.get(opts, :actor_id),
        project_id: Keyword.get(opts, :project_id),
        intent_id: Keyword.get(opts, :intent_id),
        session_id: Keyword.get(opts, :session_id)
      },
      actor_id: Keyword.get(opts, :actor_id),
      actor_type: Keyword.get(opts, :actor_type),
      surface: Keyword.get(opts, :surface),
      project_id: Keyword.get(opts, :project_id),
      intent_id: Keyword.get(opts, :intent_id),
      session_id: Keyword.get(opts, :session_id),
      authority_level: :assembled,
      sensitivity: Keyword.get(opts, :sensitivity_ceiling, :internal),
      sections: %{
        current_reality: Enum.map(items, &Map.take(&1, [:id, :title, :summary, :entity_kind, :source_kind])),
        source_count: length(items)
      },
      sources: Enum.map(items, &%{id: &1.id, source_kind: &1.source_kind, source_ref: &1.source_ref}),
      metadata: %{phase: 1, status: :skeleton}
    })
  end
end
