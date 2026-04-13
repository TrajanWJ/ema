defmodule Ema.Repo.Migrations.CreateBehaviorRules do
  use Ecto.Migration

  def change do
    create table(:behavior_rules, primary_key: false) do
      add :id, :string, primary_key: true
      add :source, :string, null: false
      add :content, :text, null: false
      add :status, :string, default: "proposed", null: false
      add :version, :integer, default: 1, null: false
      add :diff, :text
      add :signal_metadata, :text, default: "{}"
      add :previous_rule_id, references(:behavior_rules, type: :string, on_delete: :nilify_all)
      add :proposal_id, references(:proposals, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:behavior_rules, [:status])
    create index(:behavior_rules, [:source])
    create index(:behavior_rules, [:previous_rule_id])
    create index(:behavior_rules, [:proposal_id])
  end
end
