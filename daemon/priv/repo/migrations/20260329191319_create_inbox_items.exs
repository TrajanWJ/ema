defmodule Ema.Repo.Migrations.CreateInboxItems do
  use Ecto.Migration

  def change do
    create table(:inbox_items, primary_key: false) do
      add :id, :string, primary_key: true
      add :content, :text, null: false
      add :source, :string, null: false, default: "text"
      add :processed, :boolean, null: false, default: false
      add :action, :string
      add :processed_at, :utc_datetime
      timestamps(type: :utc_datetime)
    end

    create index(:inbox_items, [:processed])
  end
end
