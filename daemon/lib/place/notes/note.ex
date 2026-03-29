defmodule Place.Notes.Note do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "notes" do
    field :title, :string
    field :content, :string
    field :source_type, :string
    field :source_id, :string

    timestamps(type: :utc_datetime)
  end

  def changeset(note, attrs) do
    note
    |> cast(attrs, [:id, :title, :content, :source_type, :source_id])
    |> validate_required([:id])
  end
end
