defmodule Ema.Repo.Migrations.CreateContacts do
  use Ecto.Migration

  def change do
    create table(:contacts, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :email, :string
      add :phone, :string
      add :company, :string
      add :role, :string
      add :notes, :text
      add :tags, :map, default: %{}
      add :status, :string, default: "active"
      timestamps(type: :utc_datetime)
    end
  end
end
