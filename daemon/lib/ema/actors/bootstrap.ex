defmodule Ema.Actors.Bootstrap do
  @moduledoc """
  Ensures actor records exist for the human operator and all active agents.
  Called on application startup. Idempotent — skips actors that already exist.
  """

  require Logger

  alias Ema.Actors
  alias Ema.Actors.Actor
  alias Ema.Agents

  @default_space_id "sp_default"

  def ensure_defaults do
    ensure_human_actor()
    ensure_agent_actors()
    :ok
  end

  defp ensure_human_actor do
    case Actors.get_actor_by_slug("trajan") do
      %Actor{} = actor ->
        Logger.debug("[Actors.Bootstrap] human actor 'trajan' already exists")
        {:ok, actor}

      nil ->
        case Actors.create_actor(%{
               name: "Trajan",
               slug: "trajan",
               actor_type: "human",
               space_id: @default_space_id,
               status: "active",
               phase: "idle"
             }) do
          {:ok, actor} ->
            Logger.info("[Actors.Bootstrap] created human actor: #{actor.id}")
            {:ok, actor}

          {:error, reason} ->
            Logger.warning("[Actors.Bootstrap] failed to create human actor: #{inspect(reason)}")
            {:error, reason}
        end
    end
  end

  defp ensure_agent_actors do
    active_agents = Agents.list_active_agents()
    Logger.info("[Actors.Bootstrap] syncing #{length(active_agents)} active agents to actor records")

    for agent <- active_agents do
      ensure_agent_actor(agent)
    end
  end

  defp ensure_agent_actor(%Ema.Agents.Agent{} = agent) do
    case Actors.get_actor_by_slug(agent.slug) do
      %Actor{id: actor_id} = _actor ->
        # Actor exists — ensure the agent has the FK backfilled
        maybe_backfill_agent_fk(agent, actor_id)

      nil ->
        # Create actor for this agent
        case Actors.create_actor(%{
               name: agent.name,
               slug: agent.slug,
               actor_type: "agent",
               space_id: @default_space_id,
               status: "active",
               phase: "idle",
               config: %{
                 "model" => agent.model,
                 "role" => get_in(agent.settings || %{}, ["role"]),
                 "tools" => agent.tools || []
               }
             }) do
          {:ok, actor} ->
            Logger.info("[Actors.Bootstrap] created actor '#{actor.slug}' for agent '#{agent.slug}'")
            maybe_backfill_agent_fk(agent, actor.id)

          {:error, reason} ->
            Logger.warning("[Actors.Bootstrap] failed to create actor for agent '#{agent.slug}': #{inspect(reason)}")
        end
    end
  end

  defp maybe_backfill_agent_fk(%Ema.Agents.Agent{actor_id: existing} = _agent, _actor_id)
       when is_binary(existing) and existing != "" do
    :ok
  end

  defp maybe_backfill_agent_fk(%Ema.Agents.Agent{} = agent, actor_id) do
    case Agents.update_agent(agent, %{actor_id: actor_id}) do
      {:ok, _} ->
        Logger.info("[Actors.Bootstrap] backfilled actor_id on agent '#{agent.slug}'")

      {:error, reason} ->
        Logger.warning("[Actors.Bootstrap] failed to backfill actor_id on agent '#{agent.slug}': #{inspect(reason)}")
    end
  end
end
