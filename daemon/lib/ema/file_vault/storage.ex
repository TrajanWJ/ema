defmodule Ema.FileVault.Storage do
  @moduledoc """
  Content-addressed file storage for the File Vault.
  Files are stored in daemon/priv/vault_files/ named by their SHA-256 hash.
  """

  @storage_dir Path.expand("priv/vault_files", :code.priv_dir(:ema) |> to_string() |> Path.join(".."))

  def storage_dir do
    dir = Application.app_dir(:ema, "priv/vault_files")
    File.mkdir_p!(dir)
    dir
  end

  @doc "Store file content and return {path_on_disk, sha256_hex, size_bytes}."
  def store(content) when is_binary(content) do
    hash = :crypto.hash(:sha256, content) |> Base.encode16(case: :lower)
    dir = storage_dir()
    dest = Path.join(dir, hash)

    unless File.exists?(dest) do
      File.write!(dest, content)
    end

    {dest, hash, byte_size(content)}
  end

  @doc "Read file content by sha256 hash."
  def read(checksum_sha256) do
    path = Path.join(storage_dir(), checksum_sha256)

    case File.read(path) do
      {:ok, content} -> {:ok, content}
      {:error, _} -> {:error, :not_found}
    end
  end

  @doc "Delete file by sha256 hash."
  def delete(checksum_sha256) do
    path = Path.join(storage_dir(), checksum_sha256)
    File.rm(path)
  end
end
