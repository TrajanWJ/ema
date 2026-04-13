defmodule Ema.Repo.Migrations.CreateReflexionEntries do
  use Ecto.Migration

  def change do
    create table(:reflexion_entries, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:agent, :string, null: false)
      add(:domain, :string, null: false)
      add(:project_slug, :string, null: false)
      add(:lesson, :text, null: false)
      add(:outcome_status, :string, null: false)

      timestamps(updated_at: false, type: :utc_datetime)
    end

    create(index(:reflexion_entries, [:agent, :domain, :project_slug, :inserted_at]))
    create(index(:reflexion_entries, [:inserted_at]))
  end
end
