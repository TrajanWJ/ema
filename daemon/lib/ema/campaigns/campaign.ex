defmodule Ema.Campaigns.Campaign do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "campaigns" do
    field :name, :string
    field :description, :string
    field :steps, {:array, :map}, default: []
    field :status, :string, default: "draft"
    field :run_count, :integer, default: 0

    timestamps(type: :utc_datetime)
  end

  @required [:name]
  @optional [:id, :description, :steps, :status, :run_count]

  def changeset(campaign, attrs) do
    campaign
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_inclusion(:status, ~w(draft active archived))
    |> put_id_if_missing()
  end

  defp put_id_if_missing(changeset) do
    if get_field(changeset, :id) do
      changeset
    else
      _ts = System.system_time(:millisecond) |> Integer.to_string()
      _rnd = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
      put_change(changeset, :id, "camp_\#{ts}_\#{rnd}")
    end
  end
end
