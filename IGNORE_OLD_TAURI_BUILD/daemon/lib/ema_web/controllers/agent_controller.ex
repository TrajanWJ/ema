defmodule EmaWeb.AgentController do
  use EmaWeb, :controller
  require Logger

  alias Ema.Agents
  alias Ema.Agents.AgentWorker
  alias Ema.Intelligence.TrustScorer

  action_fallback EmaWeb.FallbackController

  def index(conn, _params) do
    agents = Agents.list_agents()
    trust_scores = TrustScorer.all_scores()

    serialized =
      Enum.map(agents, fn agent ->
        trust = Map.get(trust_scores, agent.id)
        serialize_agent(agent) |> Map.put(:trust_score, serialize_trust(trust))
      end)

    json(conn, %{agents: serialized})
  end

  def show(conn, %{"id" => slug}) do
    case Agents.get_agent_by_slug(slug) do
      nil -> {:error, :not_found}
      agent -> json(conn, %{agent: serialize_agent(agent)})
    end
  end

  def create(conn, params) do
    attrs = %{
      slug: params["slug"],
      name: params["name"],
      description: params["description"],
      avatar: params["avatar"],
      status: params["status"] || "inactive",
      model: params["model"] || "sonnet",
      temperature: params["temperature"],
      max_tokens: params["max_tokens"],
      script_path: params["script_path"],
      tools: params["tools"] || [],
      settings: params["settings"] || %{},
      project_id: params["project_id"]
    }

    with {:ok, agent} <- Agents.create_agent(attrs) do
      EmaWeb.Endpoint.broadcast("agents:lobby", "agent_created", serialize_agent(agent))

      conn
      |> put_status(:created)
      |> json(%{agent: serialize_agent(agent)})
    end
  end

  def update(conn, %{"id" => slug} = params) do
    case Agents.get_agent_by_slug(slug) do
      nil ->
        {:error, :not_found}

      agent ->
        allowed_keys = %{
          "name" => :name,
          "description" => :description,
          "avatar" => :avatar,
          "status" => :status,
          "model" => :model,
          "temperature" => :temperature,
          "max_tokens" => :max_tokens,
          "script_path" => :script_path,
          "tools" => :tools,
          "settings" => :settings,
          "project_id" => :project_id
        }

        attrs =
          params
          |> Map.take(Map.keys(allowed_keys))
          |> Map.new(fn {k, v} -> {Map.fetch!(allowed_keys, k), v} end)

        with {:ok, updated} <- Agents.update_agent(agent, attrs) do
          EmaWeb.Endpoint.broadcast("agents:lobby", "agent_updated", serialize_agent(updated))
          json(conn, %{agent: serialize_agent(updated)})
        end
    end
  end

  def delete(conn, %{"id" => slug}) do
    case Agents.get_agent_by_slug(slug) do
      nil ->
        {:error, :not_found}

      agent ->
        # Stop the agent if running
        Ema.Agents.Supervisor.stop_agent(agent.id)

        with {:ok, _} <- Agents.delete_agent(agent) do
          EmaWeb.Endpoint.broadcast("agents:lobby", "agent_deleted", %{id: agent.id})
          json(conn, %{ok: true})
        end
    end
  end

  def chat(conn, %{"slug" => slug} = params) do
    message = params["message"] || params["prompt"] || ""
    context = Map.get(params, "context", %{})

    case AgentWorker.dispatch_to_domain(slug, message, context) do
      {:ok, response} ->
        json(conn, %{ok: true, response: response, agent: slug})

      {:error, :agent_not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Agent not found: #{slug}"})

      {:error, reason} ->
        Logger.warning("[AgentController] chat failed for #{slug}: #{inspect(reason)}")

        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "Agent dispatch failed", detail: inspect(reason)})
    end
  end

  def conversations(conn, %{"slug" => slug}) do
    case Agents.get_agent_by_slug(slug) do
      nil ->
        {:error, :not_found}

      agent ->
        convos =
          Agents.list_conversations_by_agent(agent.id)
          |> Enum.map(&serialize_conversation/1)

        json(conn, %{conversations: convos})
    end
  end

  def conversation_detail(conn, %{"slug" => slug, "id" => conv_id}) do
    case Agents.get_agent_by_slug(slug) do
      nil ->
        {:error, :not_found}

      _agent ->
        case Agents.get_conversation_with_messages(conv_id) do
          nil ->
            {:error, :not_found}

          conv ->
            json(conn, %{
              conversation: serialize_conversation(conv),
              messages: Enum.map(conv.messages, &serialize_message/1)
            })
        end
    end
  end

  def network_status(conn, _params) do
    status = Ema.Agents.NetworkMonitor.get_status()
    json(conn, status)
  end

  # --- Serializers ---

  defp serialize_agent(agent) do
    %{
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      avatar: agent.avatar,
      status: agent.status,
      model: agent.model,
      temperature: agent.temperature,
      max_tokens: agent.max_tokens,
      script_path: agent.script_path,
      tools: agent.tools,
      settings: agent.settings,
      project_id: agent.project_id,
      created_at: agent.inserted_at,
      updated_at: agent.updated_at
    }
  end

  defp serialize_trust(nil), do: nil

  defp serialize_trust(trust) do
    badge = TrustScorer.badge(trust.score)

    %{
      score: trust.score,
      label: badge.label,
      color: badge.color,
      completion_rate: trust.completion_rate,
      avg_latency_ms: trust.avg_latency_ms,
      error_count: trust.error_count,
      session_count: trust.session_count,
      days_active: trust.days_active,
      calculated_at: trust.calculated_at
    }
  end

  defp serialize_conversation(conv) do
    %{
      id: conv.id,
      channel_type: conv.channel_type,
      channel_id: conv.channel_id,
      external_user_id: conv.external_user_id,
      status: conv.status,
      metadata: conv.metadata,
      created_at: conv.inserted_at,
      updated_at: conv.updated_at
    }
  end

  defp serialize_message(msg) do
    %{
      id: msg.id,
      role: msg.role,
      content: msg.content,
      tool_calls: msg.tool_calls,
      token_count: msg.token_count,
      metadata: msg.metadata,
      created_at: msg.inserted_at
    }
  end
end
