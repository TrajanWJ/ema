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
    System.get_env("EMA_VAULT_PATH") ||
      Application.get_env(:ema, :vault_path) ||
      Path.expand("~/.local/share/ema/vault")
  end

  @doc """
  Returns the Obsidian vault path (Trajan's personal knowledge vault).

  This is separate from `vault_path/0` which points to the EMA-managed vault.
  Configure via: config :ema, obsidian_vault_path: "/path/to/vault"
  """
  def obsidian_vault_path do
    Application.get_env(:ema, :obsidian_vault_path) ||
      Path.expand("~/vault")
  end
end
