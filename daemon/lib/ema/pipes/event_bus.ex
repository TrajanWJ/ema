defmodule Ema.Pipes.EventBus do
  @moduledoc """
  Broadcasts domain events to PubSub topics that the Pipes Executor subscribes to.
  Contexts call `broadcast_event/2` to fire pipe triggers.
  """

  @doc """
  Broadcast a domain event that pipes can react to.

  `trigger_pattern` should match a registered trigger id, e.g. "tasks:created".
  `payload` is a map of event data passed to transforms and actions.
  """
  def broadcast_event(trigger_pattern, payload)
      when is_binary(trigger_pattern) and is_map(payload) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "pipe_trigger:#{trigger_pattern}",
      {:pipe_event, trigger_pattern, payload}
    )
  end
end
