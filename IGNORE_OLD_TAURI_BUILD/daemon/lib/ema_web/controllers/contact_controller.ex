defmodule EmaWeb.ContactController do
  use EmaWeb, :controller

  alias Ema.Contacts

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    opts =
      []
      |> maybe_add(:status, params["status"])

    contacts = Contacts.list_contacts(opts) |> Enum.map(&serialize/1)
    json(conn, %{contacts: contacts})
  end

  def show(conn, %{"id" => id}) do
    case Contacts.get_contact(id) do
      nil -> {:error, :not_found}
      contact -> json(conn, %{contact: serialize(contact)})
    end
  end

  def create(conn, params) do
    attrs = %{
      name: params["name"],
      email: params["email"],
      phone: params["phone"],
      company: params["company"],
      role: params["role"],
      notes: params["notes"],
      tags: params["tags"] || %{},
      status: params["status"] || "active"
    }

    with {:ok, contact} <- Contacts.create_contact(attrs) do
      conn
      |> put_status(:created)
      |> json(%{contact: serialize(contact)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    attrs =
      %{}
      |> maybe_put(:name, params["name"])
      |> maybe_put(:email, params["email"])
      |> maybe_put(:phone, params["phone"])
      |> maybe_put(:company, params["company"])
      |> maybe_put(:role, params["role"])
      |> maybe_put(:notes, params["notes"])
      |> maybe_put(:tags, params["tags"])
      |> maybe_put(:status, params["status"])

    with {:ok, contact} <- Contacts.update_contact(id, attrs) do
      json(conn, %{contact: serialize(contact)})
    end
  end

  def delete(conn, %{"id" => id}) do
    with {:ok, _} <- Contacts.delete_contact(id) do
      json(conn, %{ok: true})
    end
  end

  defp serialize(contact) do
    %{
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      role: contact.role,
      notes: contact.notes,
      tags: contact.tags,
      status: contact.status,
      created_at: contact.inserted_at,
      updated_at: contact.updated_at
    }
  end

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, val), do: Keyword.put(opts, key, val)

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, val), do: Map.put(map, key, val)
end
