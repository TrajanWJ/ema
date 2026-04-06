defmodule Ema.Invoices do
  @moduledoc """
  Invoice Billing — create, send, and track invoices.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Invoices.Invoice

  def list_invoices(opts \\ []) do
    query =
      Invoice
      |> order_by(desc: :inserted_at)

    query =
      case Keyword.get(opts, :status) do
        nil -> query
        status -> where(query, [i], i.status == ^status)
      end

    query =
      case Keyword.get(opts, :contact_id) do
        nil -> query
        cid -> where(query, [i], i.contact_id == ^cid)
      end

    Repo.all(query)
  end

  def get_invoice(id), do: Repo.get(Invoice, id)

  def get_invoice!(id), do: Repo.get!(Invoice, id)

  def create_invoice(attrs) do
    id = generate_id("inv")

    %Invoice{}
    |> Invoice.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_broadcast(:invoice_created)
  end

  def update_invoice(id, attrs) do
    case get_invoice(id) do
      nil ->
        {:error, :not_found}

      invoice ->
        invoice
        |> Invoice.changeset(attrs)
        |> Repo.update()
        |> tap_broadcast(:invoice_updated)
    end
  end

  def delete_invoice(id) do
    case get_invoice(id) do
      nil -> {:error, :not_found}
      invoice -> Repo.delete(invoice) |> tap_broadcast(:invoice_deleted)
    end
  end

  def mark_sent(id) do
    update_invoice(id, %{status: "sent"})
  end

  def mark_paid(id) do
    update_invoice(id, %{status: "paid", paid_at: DateTime.utc_now()})
  end

  defp tap_broadcast(result, event) do
    case result do
      {:ok, record} ->
        Phoenix.PubSub.broadcast(Ema.PubSub, "invoices:updates", {event, record})
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
