defmodule Ema.Config do
  @moduledoc """
  Centralised config helpers for EMA.

  All modules should call these functions instead of resolving config independently.
  This avoids compile_env vs get_env drift where runtime overrides are silently ignored.
  """

  @doc """
  Returns the EMA vault path. Reads from application env at runtime,
  falling back to the standard XDG data location.

  Configure via: config :ema, vault_path: "/custom/path"
  or at runtime via EMA_VAULT_PATH environment variable (legacy; prefer app config).
  """
  def vault_path do
    Application.get_env(:ema, :vault_path, Path.expand("~/.local/share/ema/vault"))
  end
end
