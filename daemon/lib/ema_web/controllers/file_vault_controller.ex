defmodule EmaWeb.FileVaultController do
  use EmaWeb, :controller

  alias Ema.FileVault

  action_fallback EmaWeb.FallbackController

  def index(conn, _params) do
    files = FileVault.list_files() |> Enum.map(&serialize/1)
    json(conn, %{files: files})
  end

  def show(conn, %{"id" => id}) do
    case FileVault.get_file(id) do
      nil -> {:error, :not_found}
      file -> json(conn, %{file: serialize(file)})
    end
  end

  def create(conn, params) do
    attrs = %{
      filename: params["filename"],
      path: params["path"],
      size_bytes: params["size_bytes"],
      mime_type: params["mime_type"],
      tags: params["tags"] || %{},
      project_id: params["project_id"]
    }

    with {:ok, file} <- FileVault.create_file(attrs) do
      conn
      |> put_status(:created)
      |> json(%{file: serialize(file)})
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, _} <- FileVault.delete_file(id) do
      json(conn, %{ok: true})
    end
  end

  defp serialize(file) do
    %{
      id: file.id,
      filename: file.filename,
      path: file.path,
      size_bytes: file.size_bytes,
      mime_type: file.mime_type,
      tags: file.tags,
      project_id: file.project_id,
      uploaded_at: file.uploaded_at,
      created_at: file.inserted_at,
      updated_at: file.updated_at
    }
  end

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, val), do: Keyword.put(opts, key, val)
end
