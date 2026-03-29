defmodule Ema.Repo.Migrations.CreateGoals do
  use Ecto.Migration

  def change do
    create table(:goals, primary_key: false) do
      add :id, :string, primary_key: true
      add :title, :string, null: false
      add :description, :text
      add :timeframe, :string, null: false
      add :status, :string, default: "active"
      add :parent_id, references(:goals, type: :string, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:goals, [:timeframe])
    create index(:goals, [:status])
    create index(:goals, [:parent_id])
  end
end
