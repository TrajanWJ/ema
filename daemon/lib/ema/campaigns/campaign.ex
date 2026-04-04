defmodule Ema.Campaigns.Campaign do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "campaigns" do
    field :name, :string
    field :description, :string
    field :steps, {:array, :map}, default: []
    field :status, :string, default: "forming"
    field :run_count, :integer, default: 0
    field :project_id, :string

    timestamps(type: :utc_datetime)
  end

  @required [:name]
  @optional [:id, :description, :steps, :status, :run_count, :project_id]

  def changeset(campaign, attrs) do
    campaign
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_inclusion(:status, ~w(forming ready running completed archived))
    |> put_id_if_missing()
  end

  defp put_id_if_missing(changeset) do
    if get_field(changeset, :id) do
      changeset
    else
      ts = System.system_time(:millisecond) |> Integer.to_string()
      rnd = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
      put_change(changeset, :id, "camp_\#{ts}_\#{rnd}")
    end
  end
end
