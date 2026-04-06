defmodule Ema.FileVault.ManagedFile do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "managed_files" do
    field :filename, :string
    field :path, :string
    field :size_bytes, :integer
    field :mime_type, :string
    field :tags, :map, default: %{}
    field :project_id, :string
    field :uploaded_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  def changeset(file, attrs) do
    file
    |> cast(attrs, [
      :id,
      :filename,
      :path,
      :size_bytes,
      :mime_type,
      :tags,
      :project_id,
      :uploaded_at
    ])
    |> validate_required([:id, :filename, :path])
  end
end
