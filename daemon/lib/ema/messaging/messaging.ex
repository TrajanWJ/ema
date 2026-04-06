defmodule Ema.Messaging do
  @moduledoc "Unified P2P messaging — conversations and messages."

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Messaging.{Conversation, Message}

  # Conversations

  def list_conversations do
    Conversation |> order_by(desc: :updated_at) |> Repo.all()
  end

  def get_conversation(id), do: Repo.get(Conversation, id)

  def create_conversation(attrs) do
    id = generate_id("conv")

    participants =
      case Map.get(attrs, :participants, Map.get(attrs, "participants")) do
        list when is_list(list) -> Jason.encode!(list)
        str when is_binary(str) -> str
        _ -> "[]"
      end

    %Conversation{}
    |> Conversation.changeset(Map.merge(attrs, %{id: id, participants: participants}))
    |> Repo.insert()
  end

  def delete_conversation(id) do
    case get_conversation(id) do
      nil -> {:error, :not_found}
      conv -> Repo.delete(conv)
    end
  end

  # Messages

  def list_messages(conversation_id) do
    Message
    |> where([m], m.conversation_id == ^conversation_id)
    |> order_by(asc: :inserted_at)
    |> Repo.all()
  end

  def create_message(attrs) do
    id = generate_id("msg")

    attachments =
      case Map.get(attrs, :attachments, Map.get(attrs, "attachments")) do
        list when is_list(list) -> Jason.encode!(list)
        str when is_binary(str) -> str
        _ -> "[]"
      end

    result =
      %Message{}
      |> Message.changeset(Map.merge(attrs, %{id: id, attachments: attachments}))
      |> Repo.insert()

    case result do
      {:ok, msg} ->
        # Touch conversation updated_at
        Conversation
        |> where([c], c.id == ^msg.conversation_id)
        |> Repo.update_all(set: [updated_at: DateTime.utc_now()])

        {:ok, msg}

      error ->
        error
    end
  end

  def delete_message(id) do
    case Repo.get(Message, id) do
      nil -> {:error, :not_found}
      msg -> Repo.delete(msg)
    end
  end

  defp generate_id(prefix) do
    ts = System.system_time(:millisecond) |> Integer.to_string()
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{ts}_#{rand}"
  end
end
