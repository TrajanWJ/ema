defmodule Ema.FileVault do
  @moduledoc """
  File Vault — manage and tag files with project association.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.FileVault.ManagedFile

  def list_files(opts \\ []) do
    query =
      ManagedFile
      |> order_by(desc: :uploaded_at, desc: :inserted_at)

    query =
      case Keyword.get(opts, :project_id) do
        nil -> query
        pid -> where(query, [f], f.project_id == ^pid)
      end

    Repo.all(query)
  end

  def get_file(id), do: Repo.get(ManagedFile, id)

  def get_file!(id), do: Repo.get!(ManagedFile, id)

  def create_file(attrs) do
    id = generate_id("file")

    attrs =
      attrs
      |> Map.put(:id, id)
      |> Map.put_new(:uploaded_at, DateTime.utc_now())

    %ManagedFile{}
    |> ManagedFile.changeset(attrs)
    |> Repo.insert()
    |> tap_broadcast(:file_created)
  end

  def delete_file(id) do
    case get_file(id) do
      nil -> {:error, :not_found}
      file -> Repo.delete(file) |> tap_broadcast(:file_deleted)
    end
  end

  def by_project(project_id) do
    ManagedFile
    |> where([f], f.project_id == ^project_id)
    |> order_by(desc: :uploaded_at)
    |> Repo.all()
  end

  defp tap_broadcast(result, event) do
    case result do
      {:ok, record} ->
        Phoenix.PubSub.broadcast(Ema.PubSub, "file_vault:updates", {event, record})
        {:ok, record}

      error ->
        error
    end
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
