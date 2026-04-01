defmodule Ema.Notes.Note do
  @moduledoc """
  Stub schema for the `notes` table. This duplicates Ema.SecondBrain.Note
  (which backs `vault_notes`) and should be consolidated into SecondBrain
  in a future migration. Kept for now because the migration that created the
  `notes` table still exists.

  Prefer Ema.SecondBrain.Note for all new code.
  """

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
