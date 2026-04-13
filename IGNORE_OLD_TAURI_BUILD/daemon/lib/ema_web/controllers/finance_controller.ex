defmodule EmaWeb.FinanceController do
  use EmaWeb, :controller

  alias Ema.Finance

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_add(:type, params["type"])
      |> maybe_add(:category, params["category"])
      |> maybe_add(:project_id, params["project_id"])

    transactions = Finance.list_transactions(opts) |> Enum.map(&serialize/1)
    json(conn, %{transactions: transactions})
  end

  def show(conn, %{"id" => id}) do
    case Finance.get_transaction(id) do
      nil -> {:error, :not_found}
      txn -> json(conn, %{transaction: serialize(txn)})
    end
  end

  def create(conn, params) do
    attrs = %{
      description: params["description"],
      amount: params["amount"],
      type: params["type"],
      category: params["category"],
      date: parse_date(params["date"]),
      project_id: params["project_id"],
      recurring: params["recurring"] || false,
      notes: params["notes"]
    }

    with {:ok, txn} <- Finance.create_transaction(attrs) do
      conn
      |> put_status(:created)
      |> json(%{transaction: serialize(txn)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    attrs =
      %{}
      |> maybe_put(:description, params["description"])
      |> maybe_put(:amount, params["amount"])
      |> maybe_put(:type, params["type"])
      |> maybe_put(:category, params["category"])
      |> maybe_put(:date, parse_date(params["date"]))
      |> maybe_put(:project_id, params["project_id"])
      |> maybe_put(:recurring, params["recurring"])
      |> maybe_put(:notes, params["notes"])

    with {:ok, txn} <- Finance.update_transaction(id, attrs) do
      json(conn, %{transaction: serialize(txn)})
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, _} <- Finance.delete_transaction(id) do
      json(conn, %{ok: true})
    end
  end

  def summary(conn, _params) do
    summary = Finance.summary()

    json(conn, %{
      summary: %{
        income: Decimal.to_string(summary.income),
        expense: Decimal.to_string(summary.expense),
        net: Decimal.to_string(summary.net)
      }
    })
  end

  defp serialize(txn) do
    %{
      id: txn.id,
      description: txn.description,
      amount: txn.amount && Decimal.to_string(txn.amount),
      type: txn.type,
      category: txn.category,
      date: txn.date,
      project_id: txn.project_id,
      recurring: txn.recurring,
      notes: txn.notes,
      created_at: txn.inserted_at,
      updated_at: txn.updated_at
    }
  end

  defp parse_date(nil), do: nil

  defp parse_date(date_string) when is_binary(date_string) do
    case Date.from_iso8601(date_string) do
      {:ok, date} -> date
      {:error, _} -> nil
    end
  end

  defp parse_date(_), do: nil

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, val), do: Keyword.put(opts, key, val)

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, val), do: Map.put(map, key, val)
end
