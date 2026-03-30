defmodule Ema.Agents.ApiChannel do
  @moduledoc """
  Handles API endpoint chat requests for agents.
  Not a GenServer — called synchronously from the controller.
  """

  alias Ema.Agents
  alias Ema.Agents.AgentWorker

  @doc """
  Process a chat request from the REST API.
  Creates or retrieves a conversation, forwards to AgentWorker.

  Returns {:ok, %{reply: string, conversation_id: string, tool_calls: list}}
  or {:error, reason}.
  """
  def chat(agent_slug, message, opts \\ []) do
    conversation_id = Keyword.get(opts, :conversation_id)
    external_user_id = Keyword.get(opts, :external_user_id, "api_user")

    case Agents.get_agent_by_slug(agent_slug) do
      nil ->
        {:error, :agent_not_found}

      agent ->
        if agent.status != "active" do
          {:error, :agent_inactive}
        else
          conversation =
            if conversation_id do
              Agents.get_conversation(conversation_id)
            else
              nil
            end

          conv_result =
            if conversation do
              {:ok, conversation}
            else
              Agents.get_or_create_conversation(
                agent.id,
                "api",
                nil,
                external_user_id
              )
            end

          case conv_result do
            {:ok, conv} ->
              case AgentWorker.send_message(agent.id, conv.id, message) do
                {:ok, result} ->
                  {:ok, Map.put(result, :conversation_id, conv.id)}

                error ->
                  error
              end

            {:error, reason} ->
              {:error, reason}
          end
        end
    end
  end
end
