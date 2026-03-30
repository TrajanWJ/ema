defmodule EmaWeb.AgentChannelController do
  use EmaWeb, :controller

  alias Ema.Agents

  action_fallback EmaWeb.FallbackController

  def create(conn, %{"slug" => slug} = params) do
    case Agents.get_agent_by_slug(slug) do
      nil ->
        {:error, :not_found}

      agent ->
        attrs = %{
          agent_id: agent.id,
          channel_type: params["channel_type"],
          active: Map.get(params, "active", true),
          config: params["config"] || %{}
        }

        with {:ok, channel} <- Agents.create_channel(attrs) do
          conn
          |> put_status(:created)
          |> json(%{channel: serialize_channel(channel)})
        end
    end
  end

  def update(conn, %{"slug" => slug, "id" => id} = params) do
    with {:ok, _agent, channel} <- find_agent_channel(slug, id) do
      attrs =
        params
        |> Map.take(~w(active config status))
        |> Map.new(fn {k, v} -> {String.to_existing_atom(k), v} end)

      with {:ok, updated} <- Agents.update_channel(channel, attrs) do
        json(conn, %{channel: serialize_channel(updated)})
      end
    end
  end

  def delete(conn, %{"slug" => slug, "id" => id}) do
    with {:ok, _agent, channel} <- find_agent_channel(slug, id) do
      with {:ok, _} <- Agents.delete_channel(channel) do
        json(conn, %{ok: true})
      end
    end
  end

  def test_connection(conn, %{"slug" => slug, "id" => id}) do
    with {:ok, _agent, channel} <- find_agent_channel(slug, id) do
      # For now, just verify the channel exists and return status
      result = %{
        channel_id: channel.id,
        channel_type: channel.channel_type,
        status: channel.status,
        test_result: "ok",
        message: "Connection test placeholder — #{channel.channel_type} integration pending"
      }

      json(conn, result)
    end
  end

  defp find_agent_channel(slug, channel_id) do
    case Agents.get_agent_by_slug(slug) do
      nil ->
        {:error, :not_found}

      agent ->
        case Agents.get_channel(channel_id) do
          nil -> {:error, :not_found}
          channel -> {:ok, agent, channel}
        end
    end
  end

  defp serialize_channel(channel) do
    %{
      id: channel.id,
      channel_type: channel.channel_type,
      active: channel.active,
      config: channel.config,
      status: channel.status,
      last_connected_at: channel.last_connected_at,
      error_message: channel.error_message,
      agent_id: channel.agent_id,
      created_at: channel.inserted_at,
      updated_at: channel.updated_at
    }
  end
end
