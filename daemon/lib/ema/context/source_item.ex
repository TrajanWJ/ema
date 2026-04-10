defmodule Ema.Context.SourceItem do
  @moduledoc "Normalized source item used by the context assembler before packet assembly."

  @enforce_keys [:source_kind, :entity_kind, :title]
  defstruct [
    :id,
    :source_kind,
    :source_ref,
    :entity_kind,
    :title,
    :summary,
    :body,
    :timestamp,
    :freshness_score,
    :confidence_score,
    :authority_level,
    :sensitivity,
    :allowed_surfaces,
    :allowed_actor_types,
    intent_refs: [],
    project_refs: [],
    session_refs: [],
    tags: [],
    metadata: %{}
  ]
end
