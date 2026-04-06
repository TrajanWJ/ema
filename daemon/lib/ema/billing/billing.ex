defmodule Ema.Billing do
  @moduledoc """
  Billing context -- clients, invoices, and revenue tracking.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Billing.{Client, Invoice}

  # Clients

  def list_clients do
    Client |> order_by(asc: :name) |> Repo.all()
  end

  def get_client(id), do: Repo.get(Client, id)

  def create_client(attrs) do
    id = generate_id("cl")

    %Client{}
    |> Client.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
  end

  def update_client(%Client{} = client, attrs) do
    client
    |> Client.changeset(attrs)
    |> Repo.update()
  end

  def delete_client(%Client{} = client) do
    Repo.delete(client)
  end

  # Invoices

  def list_invoices do
    Invoice |> order_by(desc: :inserted_at) |> Repo.all()
  end

  def list_invoices_by_status(status) do
    Invoice
    |> where([i], i.status == ^status)
    |> order_by(desc: :inserted_at)
    |> Repo.all()
  end

  def list_invoices_for_client(client_id) do
    Invoice
    |> where([i], i.client_id == ^client_id)
    |> order_by(desc: :inserted_at)
    |> Repo.all()
  end

  def get_invoice(id), do: Repo.get(Invoice, id)

  def create_invoice(attrs) do
    id = generate_id("inv")
    number = generate_invoice_number()

    %Invoice{}
    |> Invoice.changeset(Map.merge(attrs, %{id: id, number: number}))
    |> Repo.insert()
  end

  def update_invoice(%Invoice{} = invoice, attrs) do
    invoice
    |> Invoice.changeset(attrs)
    |> Repo.update()
  end

  def delete_invoice(%Invoice{} = invoice) do
    Repo.delete(invoice)
  end

  def revenue_summary do
    now = Date.utc_today()
    month_start = Date.beginning_of_month(now)

    paid_this_month =
      Invoice
      |> where([i], i.status == "paid" and i.paid_at >= ^DateTime.new!(month_start, ~T[00:00:00], "Etc/UTC"))
      |> select([i], sum(i.total))
      |> Repo.one() || 0.0

    outstanding =
      Invoice
      |> where([i], i.status in ["sent", "overdue"])
      |> select([i], sum(i.total))
      |> Repo.one() || 0.0

    overdue =
      Invoice
      |> where([i], i.status == "overdue")
      |> select([i], sum(i.total))
      |> Repo.one() || 0.0

    %{
      revenue_this_month: paid_this_month,
      outstanding: outstanding,
      overdue: overdue
    }
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end

  defp generate_invoice_number do
    now = Date.utc_today()
    count = Invoice |> Repo.aggregate(:count) |> Kernel.+(1)
    "INV-#{now.year}-#{String.pad_leading(Integer.to_string(count), 4, "0")}"
  end
end
