defmodule Ema.Config do
  @moduledoc """
  Centralised config helpers for EMA.

  All modules should call these functions instead of resolving config independently.
  This avoids compile_env vs get_env drift where runtime overrides are silently ignored.
  """

  @doc """
  Returns the EMA data directory root. All EMA state lives under this path.

  Configure via: config :ema, data_dir: "/custom/path"
  or EMA_DATA_DIR environment variable.

  Default: ~/.local/share/ema
  """
  def data_dir do
    System.get_env("EMA_DATA_DIR") ||
      Application.get_env(:ema, :data_dir) ||
      Path.expand("~/.local/share/ema")
  end

  def vault_path do
    System.get_env("EMA_VAULT_PATH") ||
      Application.get_env(:ema, :vault_path) ||
      Path.join(data_dir(), "vault")
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
