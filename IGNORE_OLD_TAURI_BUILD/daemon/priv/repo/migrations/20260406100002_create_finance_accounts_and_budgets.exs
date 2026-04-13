defmodule Ema.Repo.Migrations.CreateFinanceAccountsAndBudgets do
  use Ecto.Migration

  def change do
    create_if_not_exists table(:finance_transactions, primary_key: false) do
      add :id, :string, primary_key: true
      add :description, :string
      add :amount, :decimal, null: false
      add :type, :string
      add :category, :string
      add :date, :date
      add :project_id, :string
      add :recurring, :boolean, default: false
      add :notes, :string

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists table(:finance_accounts, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :type, :string, null: false, default: "checking"
      add :balance, :decimal, null: false, default: 0
      add :currency, :string, null: false, default: "USD"
      add :institution, :string
      add :last_synced_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists table(:finance_budgets, primary_key: false) do
      add :id, :string, primary_key: true
      add :name, :string, null: false
      add :category, :string, null: false
      add :amount_limit, :decimal, null: false
      add :period, :string, null: false, default: "monthly"
      add :current_spent, :decimal, null: false, default: 0

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists index(:finance_transactions, [:date])
    create_if_not_exists index(:finance_transactions, [:category])
    create_if_not_exists index(:finance_budgets, [:category])
  end
end
