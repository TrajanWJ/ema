defmodule Ema.Voice.Supervisor do
  @moduledoc """
  Supervises the VoiceCore voice subsystem processes.
  """
  use Supervisor

  def start_link(init_arg) do
    Supervisor.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  @impl true
  def init(_init_arg) do
    children = [
      {Registry, keys: :unique, name: Ema.Voice.Registry},
      {DynamicSupervisor, name: Ema.Voice.SessionSupervisor, strategy: :one_for_one},
      Ema.Voice.TtsEngine
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end
