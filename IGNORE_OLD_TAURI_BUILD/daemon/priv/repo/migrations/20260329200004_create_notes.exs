defmodule Ema.Repo.Migrations.CreateNotes do
  use Ecto.Migration

  def change do
    create table(:notes, primary_key: false) do
      add :id, :string, primary_key: true
      add :title, :string
      add :content, :text
      add :source_type, :string
      add :source_id, :string

      timestamps(type: :utc_datetime)
    end

    create index(:notes, [:source_type, :source_id])
  end
end
