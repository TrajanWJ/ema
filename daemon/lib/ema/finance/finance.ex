defmodule Ema.Finance do
  @moduledoc """
  Finance Tracker — income/expense tracking with summaries.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Finance.Transaction

  def list_transactions(opts \\ []) do
    query =
      Transaction
      |> order_by(desc: :date, desc: :inserted_at)

    query =
      case Keyword.get(opts, :type) do
        nil -> query
        type -> where(query, [t], t.type == ^type)
      end

    query =
      case Keyword.get(opts, :category) do
        nil -> query
        cat -> where(query, [t], t.category == ^cat)
      end

    query =
      case Keyword.get(opts, :project_id) do
        nil -> query
        pid -> where(query, [t], t.project_id == ^pid)
      end

    Repo.all(query)
  end

  def get_transaction(id), do: Repo.get(Transaction, id)

  def get_transaction!(id), do: Repo.get!(Transaction, id)

  def create_transaction(attrs) do
    id = generate_id("txn")

    %Transaction{}
    |> Transaction.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_broadcast(:transaction_created)
  end

  def update_transaction(id, attrs) do
    case get_transaction(id) do
      nil -> {:error, :not_found}

      txn ->
        txn
        |> Transaction.changeset(attrs)
        |> Repo.update()
        |> tap_broadcast(:transaction_updated)
    end
  end

  def delete_transaction(id) do
    case get_transaction(id) do
      nil -> {:error, :not_found}
      txn -> Repo.delete(txn) |> tap_broadcast(:transaction_deleted)
    end
  end

  def summary do
    income =
      Transaction
      |> where([t], t.type == "income")
      |> select([t], sum(t.amount))
      |> Repo.one() || Decimal.new(0)

    expense =
      Transaction
      |> where([t], t.type == "expense")
      |> select([t], sum(t.amount))
      |> Repo.one() || Decimal.new(0)

    net = Decimal.sub(income, expense)

    %{income: income, expense: expense, net: net}
  end

  defp tap_broadcast(result, event) do
    case result do
      {:ok, record} ->
        Phoenix.PubSub.broadcast(Ema.PubSub, "finance:updates", {event, record})
        {:ok, record}

      error ->
        error
    end
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
