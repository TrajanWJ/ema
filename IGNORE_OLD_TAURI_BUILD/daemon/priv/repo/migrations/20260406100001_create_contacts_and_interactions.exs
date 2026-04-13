defmodule Ema.Repo.Migrations.CreateContactsAndInteractions do
  use Ecto.Migration

  def change do
    create_if_not_exists table(:contacts, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :email, :string
      add :phone, :string
      add :company, :string
      add :role, :string
      add :notes, :text
      add :tags, :text, null: false, default: "{}"
      add :status, :string, default: "active"

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists table(:contact_interactions, primary_key: false) do
      add :id, :string, primary_key: true
      add :contact_id, references(:contacts, type: :string, on_delete: :delete_all), null: false
      add :type, :string, null: false, default: "message"
      add :summary, :text
      add :date, :string, null: false

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists index(:contact_interactions, [:contact_id])
    create_if_not_exists index(:contact_interactions, [:date])
    create_if_not_exists index(:contacts, [:status])
  end
end
