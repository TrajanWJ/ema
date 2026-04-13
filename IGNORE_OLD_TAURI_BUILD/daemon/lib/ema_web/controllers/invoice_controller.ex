defmodule EmaWeb.InvoiceController do
  use EmaWeb, :controller

  alias Ema.Invoices

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_add(:status, params["status"])
      |> maybe_add(:contact_id, params["contact_id"])

    invoices = Invoices.list_invoices(opts) |> Enum.map(&serialize/1)
    json(conn, %{invoices: invoices})
  end

  def show(conn, %{"id" => id}) do
    case Invoices.get_invoice(id) do
      nil -> {:error, :not_found}
      invoice -> json(conn, %{invoice: serialize(invoice)})
    end
  end

  def create(conn, params) do
    attrs = %{
      contact_id: params["contact_id"],
      project_id: params["project_id"],
      items: params["items"] || %{},
      subtotal: params["subtotal"],
      tax: params["tax"],
      total: params["total"],
      status: params["status"] || "draft",
      due_date: parse_date(params["due_date"]),
      notes: params["notes"]
    }

    with {:ok, invoice} <- Invoices.create_invoice(attrs) do
      conn
      |> put_status(:created)
      |> json(%{invoice: serialize(invoice)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    attrs =
      %{}
      |> maybe_put(:contact_id, params["contact_id"])
      |> maybe_put(:project_id, params["project_id"])
      |> maybe_put(:items, params["items"])
      |> maybe_put(:subtotal, params["subtotal"])
      |> maybe_put(:tax, params["tax"])
      |> maybe_put(:total, params["total"])
      |> maybe_put(:status, params["status"])
      |> maybe_put(:due_date, parse_date(params["due_date"]))
      |> maybe_put(:notes, params["notes"])

    with {:ok, invoice} <- Invoices.update_invoice(id, attrs) do
      json(conn, %{invoice: serialize(invoice)})
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, _} <- Invoices.delete_invoice(id) do
      json(conn, %{ok: true})
    end
  end

  def send_invoice(conn, %{"id" => id}) do
    with {:ok, invoice} <- Invoices.mark_sent(id) do
      json(conn, %{invoice: serialize(invoice)})
    end
  end

  def mark_paid(conn, %{"id" => id}) do
    with {:ok, invoice} <- Invoices.mark_paid(id) do
      json(conn, %{invoice: serialize(invoice)})
    end
  end

  defp serialize(invoice) do
    %{
      id: invoice.id,
      contact_id: invoice.contact_id,
      project_id: invoice.project_id,
      items: invoice.items,
      subtotal: invoice.subtotal && Decimal.to_string(invoice.subtotal),
      tax: invoice.tax && Decimal.to_string(invoice.tax),
      total: invoice.total && Decimal.to_string(invoice.total),
      status: invoice.status,
      due_date: invoice.due_date,
      paid_at: invoice.paid_at,
      notes: invoice.notes,
      created_at: invoice.inserted_at,
      updated_at: invoice.updated_at
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
