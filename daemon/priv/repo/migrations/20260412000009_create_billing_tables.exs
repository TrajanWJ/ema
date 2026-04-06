defmodule Ema.Repo.Migrations.CreateBillingTables do
  use Ecto.Migration

  def change do
    create table(:billing_clients, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :email, :string
      add :company, :string
      add :billing_address, :string
      add :payment_terms_days, :integer, default: 30
      add :notes, :string

      timestamps(type: :utc_datetime)
    end

    create table(:invoices, primary_key: false) do
      add :id, :string, primary_key: true
      add :client_id, :string
      add :number, :string
      add :status, :string, default: "draft"
      add :items, :map, default: %{"items" => []}
      add :subtotal, :float, default: 0.0
      add :tax_rate, :float, default: 0.0
      add :total, :float, default: 0.0
      add :due_date, :date
      add :paid_at, :utc_datetime
      add :notes, :string

      timestamps(type: :utc_datetime)
    end

    create unique_index(:invoices, [:number])
    create index(:invoices, [:client_id])
    create index(:invoices, [:status])
  end
end
