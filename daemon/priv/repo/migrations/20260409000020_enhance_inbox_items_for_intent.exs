defmodule Ema.Repo.Migrations.EnhanceInboxItemsForIntent do
  use Ecto.Migration

  def change do
    alter table(:inbox_items) do
      add :tags, :string, default: "[]"
      add :item_type, :string, default: "idea"
      add :priority, :integer, default: 5
      add :space_id, :string
      add :cluster_id, :string
      add :intent_score, :float, default: 0.0
    end
  end
end
