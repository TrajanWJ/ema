defmodule Ema.Repo.Migrations.CreateJournalEntries do
  use Ecto.Migration

  def change do
    create table(:journal_entries, primary_key: false) do
      add :id, :string, primary_key: true
      add :date, :string, null: false
      add :content, :text, null: false, default: ""
      add :one_thing, :string
      add :mood, :integer
      add :energy_p, :integer
      add :energy_m, :integer
      add :energy_e, :integer
      add :gratitude, :text
      add :tags, :string
      timestamps(type: :utc_datetime)
    end

    create unique_index(:journal_entries, [:date])
  end
end
