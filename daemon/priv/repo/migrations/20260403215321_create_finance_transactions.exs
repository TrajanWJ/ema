defmodule Ema.Repo.Migrations.CreateFinanceTransactions do
  use Ecto.Migration

  def change do
    create table(:finance_transactions, primary_key: false) do
      add :id, :string, primary_key: true
      add :description, :string, null: false
      add :amount, :decimal, null: false
      add :type, :string, null: false, default: "expense"
      add :category, :string
      add :date, :date
      add :project_id, :string
      add :recurring, :boolean, default: false
      add :notes, :text
      timestamps(type: :utc_datetime)
    end
  end
end
