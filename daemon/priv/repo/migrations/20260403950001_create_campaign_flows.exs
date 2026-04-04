defmodule Ema.Repo.Migrations.CreateCampaignFlows do
  use Ecto.Migration

  def change do
    create table(:campaign_flows, primary_key: false) do
      add :id,               :string, primary_key: true
      add :campaign_id,      :string, null: false
      add :title,            :string
      add :state,            :string, null: false, default: "forming"
      add :state_entered_at, :utc_datetime
      add :state_metadata,   :text,   default: "{}"
      add :state_history,    :text,   default: "[]"

      timestamps(type: :utc_datetime)
    end

    create unique_index(:campaign_flows, [:campaign_id])
    create index(:campaign_flows, [:state])
    create index(:campaign_flows, [:inserted_at])
  end
end
