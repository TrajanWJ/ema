defmodule Ema.EntityData do
  @moduledoc false

  def set(entity_type, entity_id, actor_id, key, value) do
    Ema.Actors.set_data(actor_id, entity_type, entity_id, key, value)
  end

  def get(entity_type, entity_id, actor_id, key) do
    Ema.Actors.get_data(actor_id, entity_type, entity_id, key)
  end

  def list_for(entity_type, entity_id, actor_id) do
    Ema.Actors.list_data(actor_id, entity_type, entity_id)
  end

  def delete(entity_type, entity_id, actor_id, key) do
    Ema.Actors.delete_data(actor_id, entity_type, entity_id, key)
  end
end
