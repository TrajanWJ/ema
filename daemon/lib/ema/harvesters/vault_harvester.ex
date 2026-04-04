defmodule Ema.Harvesters.VaultHarvester do
  @moduledoc """
  VaultHarvester — scans the local vault for new/changed markdown notes
  and creates seeds for noteworthy content.

  Stub implementation for Week 7. Full semantic extraction in Week 8.
  """

  use Ema.Harvesters.Base, name: "vault", interval: :timer.hours(4)

  require Logger

  @impl Ema.Harvesters.Base
  def harvester_name, do: "vault"

  @impl Ema.Harvesters.Base
  def default_interval, do: :timer.hours(4)

  @impl Ema.Harvesters.Base
  def harvest(_context) do
    # Week 7 stub — returns empty harvest, no errors at startup
    vault_path = System.get_env("EMA_VAULT_PATH", Path.expand("~/vault"))

    case File.stat(vault_path) do
      {:ok, _} ->
        Logger.debug("[VaultHarvester] Vault accessible at #{vault_path} — full scan deferred to Week 8")
        {:ok, %{items_found: 0, seeds_created: 0, metadata: %{stub: true, vault_path: vault_path}}}

      {:error, reason} ->
        Logger.warning("[VaultHarvester] Vault not accessible: #{inspect(reason)}")
        {:ok, %{items_found: 0, seeds_created: 0, metadata: %{stub: true, error: inspect(reason)}}}
    end
  end
end
