defmodule Ema.Integrations.OpenClaw.VaultSyncSupervisor do
  @moduledoc """
  Supervisor for OpenClaw vault sync processes.

  Children:
    - VaultMirror: periodic rsync/manifest refresh into local staging dir
    - VaultSync: consumes staging deltas, debounces, batches note upserts
    - VaultReconciler: full inventory reconcile every 15 minutes
  """

  use Supervisor

  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      Ema.Integrations.OpenClaw.VaultMirror,
      Ema.Integrations.OpenClaw.VaultSync,
      Ema.Integrations.OpenClaw.VaultReconciler
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end
end
