defmodule Ema.Contacts do
  @moduledoc """
  Contacts CRM — manage contacts with company, role, and tagging.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Contacts.Contact

  def list_contacts(opts \\ []) do
    query =
      Contact
      |> order_by(asc: :name)

    query =
      case Keyword.get(opts, :status) do
        nil -> query
        status -> where(query, [c], c.status == ^status)
      end

    Repo.all(query)
  end

  def get_contact(id), do: Repo.get(Contact, id)

  def get_contact!(id), do: Repo.get!(Contact, id)

  def create_contact(attrs) do
    id = generate_id("con")

    %Contact{}
    |> Contact.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_broadcast(:contact_created)
  end

  def update_contact(id, attrs) do
    case get_contact(id) do
      nil -> {:error, :not_found}

      contact ->
        contact
        |> Contact.changeset(attrs)
        |> Repo.update()
        |> tap_broadcast(:contact_updated)
    end
  end

  def delete_contact(id) do
    case get_contact(id) do
      nil -> {:error, :not_found}
      contact -> Repo.delete(contact) |> tap_broadcast(:contact_deleted)
    end
  end

  defp tap_broadcast(result, event) do
    case result do
      {:ok, record} ->
        Phoenix.PubSub.broadcast(Ema.PubSub, "contacts:updates", {event, record})
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
