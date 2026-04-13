defmodule Ema.Voice.Conversation do
  @moduledoc """
  Manages multi-turn voice conversations with context.
  Maintains a rolling window of messages for context building.
  """

  @max_history 20

  defstruct [
    :session_id,
    messages: [],
    started_at: nil
  ]

  @type role :: :user | :assistant | :system
  @type message :: %{role: role(), content: String.t(), timestamp: DateTime.t()}
  @type t :: %__MODULE__{
          session_id: String.t(),
          messages: [message()],
          started_at: DateTime.t() | nil
        }

  @doc """
  Create a new conversation for a voice session.
  """
  @spec new(String.t()) :: t()
  def new(session_id) do
    %__MODULE__{
      session_id: session_id,
      messages: [],
      started_at: DateTime.utc_now()
    }
  end

  @doc """
  Add a message to the conversation. Trims to max history length.
  """
  @spec add_message(t(), role(), String.t()) :: t()
  def add_message(%__MODULE__{} = conv, role, content) do
    message = %{
      role: role,
      content: content,
      timestamp: DateTime.utc_now()
    }

    messages =
      [message | conv.messages]
      |> Enum.take(@max_history)

    %{conv | messages: messages}
  end

  @doc """
  Get the conversation history in chronological order.
  """
  @spec history(t()) :: [message()]
  def history(%__MODULE__{messages: messages}) do
    Enum.reverse(messages)
  end

  @doc """
  Build a context string from recent conversation for LLM prompts.
  """
  @spec build_context(t()) :: String.t()
  def build_context(%__MODULE__{} = conv) do
    conv
    |> history()
    |> Enum.map(fn msg ->
      role_label = msg.role |> Atom.to_string() |> String.capitalize()
      "#{role_label}: #{msg.content}"
    end)
    |> Enum.join("\n")
  end

  @doc """
  Get the number of messages in the conversation.
  """
  @spec message_count(t()) :: non_neg_integer()
  def message_count(%__MODULE__{messages: messages}), do: length(messages)

  @doc """
  Clear conversation history while preserving session metadata.
  """
  @spec clear(t()) :: t()
  def clear(%__MODULE__{} = conv) do
    %{conv | messages: []}
  end
end
