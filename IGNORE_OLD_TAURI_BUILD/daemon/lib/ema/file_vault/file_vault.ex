defmodule Ema.FileVault do
  @moduledoc "P2P encrypted file storage with content-addressed naming."

  import Ecto.Query
  alias Ema.Repo
  alias Ema.FileVault.{VaultFile, Storage}

  def list_files do
    VaultFile |> order_by(desc: :inserted_at) |> Repo.all()
  end

  def get_file(id), do: Repo.get(VaultFile, id)

  def create_file(attrs) do
    id = generate_id()

    %VaultFile{}
    |> VaultFile.changeset(
      attrs
      |> Map.put(:id, id)
      |> Map.put_new_lazy(:name, fn -> Map.get(attrs, :filename, "unknown") end)
    )
    |> Repo.insert()
  end

  def upload(name, mime_type, content, opts \\ []) do
    {_disk_path, hash, size} = Storage.store(content)
    id = generate_id()

    attrs = %{
      id: id,
      name: name,
      path: hash,
      size_bytes: size,
      mime_type: mime_type,
      checksum_sha256: hash,
      encrypted: Keyword.get(opts, :encrypted, false),
      uploaded_by: Keyword.get(opts, :uploaded_by)
    }

    %VaultFile{}
    |> VaultFile.changeset(attrs)
    |> Repo.insert()
  end

  def download(id) do
    case get_file(id) do
      nil -> {:error, :not_found}
      file -> Storage.read(file.checksum_sha256)
    end
  end

  def delete_file(id) do
    case get_file(id) do
      nil ->
        {:error, :not_found}

      file ->
        # Only delete from disk if no other records reference same hash
        count =
          VaultFile
          |> where([f], f.checksum_sha256 == ^file.checksum_sha256 and f.id != ^id)
          |> Repo.aggregate(:count)

        if count == 0, do: Storage.delete(file.checksum_sha256)
        Repo.delete(file)
    end
  end

  defp generate_id do
    ts = System.system_time(:millisecond) |> Integer.to_string()
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "vf_#{ts}_#{rand}"
  end
end
