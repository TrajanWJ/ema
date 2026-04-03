defmodule Ema.Repo.Migrations.CreateInvoices do
  use Ecto.Migration

  def change do
    create table(:invoices, primary_key: false) do
      add :id, :string, primary_key: true
      add :contact_id, :string
      add :project_id, :string
      add :items, :map, default: %{}
      add :subtotal, :decimal
      add :tax, :decimal, default: 0
      add :total, :decimal
      add :status, :string, default: "draft"
      add :due_date, :date
      add :paid_at, :utc_datetime
      add :notes, :text
      timestamps(type: :utc_datetime)
    end
  end
end
