defmodule Ema.Tags do
  @moduledoc false

  def tag(entity_type, entity_id, tag, actor_id, namespace \\ "default") do
    Ema.Actors.tag_entity(entity_type, entity_id, tag, actor_id, namespace)
  end

  def list_for(entity_type, entity_id) do
    Ema.Actors.tags_for_entity(entity_type, entity_id)
  end

  def untag(entity_type, entity_id, tag, actor_id) do
    Ema.Actors.untag_entity(entity_type, entity_id, tag, actor_id)
  end
end
