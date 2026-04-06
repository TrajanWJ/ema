defmodule Ema.Spaces.Space do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  @space_types ~w(personal team project)
  @ai_privacy_opts ~w(isolated federated_read)

  schema "spaces" do
    field :name, :string
    field :space_type, :string, default: "personal"
    field :ai_privacy, :string, default: "isolated"
    field :icon, :string
    field :color, :string
    field :settings, :map, default: %{}
    field :archived_at, :utc_datetime

    belongs_to :organization, Ema.Org.Organization, type: :string, foreign_key: :org_id
    has_many :members, Ema.Spaces.Member, foreign_key: :space_id

    timestamps()
  end

  def changeset(space, attrs) do
    space
    |> cast(attrs, [
      :id,
      :org_id,
      :name,
      :space_type,
      :ai_privacy,
      :icon,
      :color,
      :settings,
      :archived_at
    ])
    |> validate_required([:org_id, :name])
    |> validate_inclusion(:space_type, @space_types)
    |> validate_inclusion(:ai_privacy, @ai_privacy_opts)
    |> validate_length(:name, min: 1, max: 100)
  end

  def space_types, do: @space_types
  def ai_privacy_opts, do: @ai_privacy_opts
end
