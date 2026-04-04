defmodule Ema.Campaigns.CampaignRun do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "campaign_runs" do
    belongs_to :campaign, Ema.Campaigns.Campaign, type: :string
    field :name, :string
    field :status, :string, default: "pending"
    field :step_statuses, :map, default: %{}
    field :started_at, :utc_datetime
    field :completed_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  @required [:campaign_id]
  @optional [:id, :name, :status, :step_statuses, :started_at, :completed_at]

  def changeset(run, attrs) do
    run
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_inclusion(:status, ~w(pending running completed failed))
    |> put_id_if_missing()
  end

  defp put_id_if_missing(changeset) do
    if get_field(changeset, :id) do
      changeset
    else
      ts = System.system_time(:millisecond) |> Integer.to_string()
      rnd = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
      put_change(changeset, :id, "run_\#{ts}_\#{rnd}")
    end
  end
end
