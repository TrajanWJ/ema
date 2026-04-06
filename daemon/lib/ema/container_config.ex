defmodule Ema.ContainerConfig do
  @moduledoc false

  def set(container_type, container_id, key, value) do
    Ema.Actors.set_config(container_type, container_id, key, value)
  end

  def get(container_type, container_id, key) do
    Ema.Actors.get_config(container_type, container_id, key)
  end

  def list_for(container_type, container_id) do
    Ema.Actors.list_config(container_type, container_id)
  end
end
