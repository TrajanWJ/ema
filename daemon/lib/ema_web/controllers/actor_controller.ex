defmodule EmaWeb.ActorController do
  use EmaWeb, :controller

  alias Ema.Actors

  action_fallback EmaWeb.FallbackController

  def index(conn, params) do
    actors =
      Actors.list_actors(
        space_id: params["space_id"],
        type: params["type"],
        status: params["status"]
      )

    json(conn, %{actors: Enum.map(actors, &serialize/1)})
  end

  def show(conn, %{"id" => id}) do
    case Actors.get_actor(id) || Actors.get_actor_by_slug(id) do
      nil -> {:error, :not_found}
      actor -> json(conn, %{actor: serialize(actor)})
    end
  end

  def create(conn, params) do
    case Actors.create_actor(params) do
      {:ok, actor} -> conn |> put_status(:created) |> json(%{actor: serialize(actor)})
      {:error, changeset} -> {:error, changeset}
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Actors.get_actor(id) do
      nil ->
        {:error, :not_found}

      actor ->
        case Actors.update_actor(actor, params) do
          {:ok, updated} -> json(conn, %{actor: serialize(updated)})
          {:error, changeset} -> {:error, changeset}
        end
    end
  end

  def delete(conn, %{"id" => id}) do
    case Actors.get_actor(id) do
      nil ->
        {:error, :not_found}

      actor ->
        case Actors.delete_actor(actor) do
          {:ok, _} -> json(conn, %{ok: true})
          {:error, changeset} -> {:error, changeset}
        end
    end
  end

  def transition_phase(conn, %{"id" => id, "phase" => phase} = params) do
    case Actors.get_actor(id) do
      nil ->
        {:error, :not_found}

      actor ->
        case Actors.transition_phase(actor, phase, params["reason"]) do
          {:ok, updated} -> json(conn, %{actor: serialize(updated)})
          {:error, changeset} -> {:error, changeset}
        end
    end
  end

  def list_tags(conn, %{"id" => id}) do
    tags = Actors.tags_for_entity("actor", id)

    json(conn, %{
      tags:
        Enum.map(tags, fn t ->
          %{
            id: t.id,
            tag: t.tag,
            namespace: t.namespace,
            actor_id: t.actor_id,
            entity_type: t.entity_type,
            entity_id: t.entity_id
          }
        end)
    })
  end

  def list_phases(conn, %{"id" => id}) do
    transitions = Actors.list_phase_transitions(id)

    json(conn, %{
      transitions:
        Enum.map(transitions, fn t ->
          %{
            id: t.id,
            actor_id: t.actor_id,
            from_phase: t.from_phase,
            to_phase: t.to_phase,
            week_number: t.week_number,
            reason: t.reason,
            summary: t.summary,
            transitioned_at: t.transitioned_at
          }
        end)
    })
  end

  def list_commands(conn, %{"id" => id}) do
    commands = Actors.list_commands(id)
    json(conn, %{commands: Enum.map(commands, &serialize_command/1)})
  end

  def register_command(conn, %{"id" => actor_id} = params) do
    attrs = Map.put(params, "actor_id", actor_id)

    case Actors.register_command(attrs) do
      {:ok, command} ->
        conn |> put_status(:created) |> json(%{command: serialize_command(command)})

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  defp serialize(%Actors.Actor{} = a) do
    %{
      id: a.id,
      space_id: a.space_id,
      type: a.actor_type,
      name: a.name,
      slug: a.slug,
      capabilities: a.capabilities,
      config: a.config,
      phase: a.phase,
      phase_started_at: a.phase_started_at,
      status: a.status,
      inserted_at: a.inserted_at,
      updated_at: a.updated_at
    }
  end

  defp serialize(nil), do: nil

  defp serialize_command(%Actors.ActorCommand{} = c) do
    %{
      id: c.id,
      actor_id: c.actor_id,
      command_name: c.command_name,
      description: c.description,
      handler: c.handler,
      args_spec: c.args_spec
    }
  end
end
