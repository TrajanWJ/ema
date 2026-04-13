defmodule Ema.Repo.Migrations.CreateBillingTables do
  use Ecto.Migration

  def change do
    create_if_not_exists table(:billing_clients, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :email, :string
      add :company, :string
      add :billing_address, :string
      add :payment_terms_days, :integer, default: 30
      add :notes, :string

      timestamps(type: :utc_datetime)
    end

    # invoices table already exists with a different column set.
    # Skip both table creation and indexes that reference columns
    # not present in the existing schema (e.g., :number, :client_id).
    # The Billing.Invoice and Invoices.Invoice dual-schema issue
    # is a known tech debt item — not resolved in this migration.
  end
end
