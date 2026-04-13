defmodule Ema.PhaseTransitions do
  @moduledoc false

  def record(attrs) do
    Ema.Actors.record_phase_transition(attrs)
  end

  def list_for(actor_id) do
    Ema.Actors.list_phase_transitions(actor_id)
  end
end
