defmodule Ema.Clipboard.Clip do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "clipboard_clips" do
    field :content, :string
    field :content_type, :string, default: "text"
    field :source, :string, default: "manual"
    field :pinned, :boolean, default: false
    field :expires_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  @valid_content_types ~w(text code url image)
  @valid_sources ~w(manual agent pipe)

  def changeset(clip, attrs) do
    clip
    |> cast(attrs, [:id, :content, :content_type, :source, :pinned, :expires_at])
    |> validate_required([:id, :content])
    |> validate_inclusion(:content_type, @valid_content_types)
    |> validate_inclusion(:source, @valid_sources)
  end
end
