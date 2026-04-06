defmodule Ema.Clipboard.Clip do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "clips" do
    field :content, :string
    field :content_type, :string, default: "text"
    field :source_device, :string
    field :pinned, :boolean, default: false
    field :expires_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  @valid_types ~w(text image link code)

  def changeset(clip, attrs) do
    clip
    |> cast(attrs, [:id, :content, :content_type, :source_device, :pinned, :expires_at])
    |> validate_required([:id, :content])
    |> validate_inclusion(:content_type, @valid_types)
  end
end
