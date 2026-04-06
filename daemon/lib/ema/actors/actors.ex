defmodule Ema.Actors do
  @moduledoc """
  Context module for the Actor/Container model.

  Actors are first-class participants (human or agent) with their own
  executive management state, phase cadence, and capabilities.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Actors.{Actor, Tag, EntityTag, EntityData, ContainerConfig, PhaseTransition, ActorCommand}

  # ── Actor CRUD ──

  def list_actors(opts \\ []) do
    Actor
    |> maybe_filter_space(opts[:space_id])
    |> maybe_filter_type(opts[:type])
    |> maybe_filter_status(opts[:status])
    |> order_by([a], desc: a.updated_at)
    |> Repo.all()
  end

  def get_actor(id), do: Repo.get(Actor, id)
  def get_actor!(id), do: Repo.get!(Actor, id)

  def get_actor_by_slug(slug), do: Repo.get_by(Actor, slug: slug)
  def get_actor_by_slug!(slug), do: Repo.get_by!(Actor, slug: slug)

  def create_actor(attrs) do
    %Actor{id: generate_id()}
    |> Actor.changeset(attrs)
    |> Repo.insert()
    |> tap_ok(&broadcast("actors", {"actor:created", &1}))
  end

  def update_actor(%Actor{} = actor, attrs) do
    actor
    |> Actor.changeset(attrs)
    |> Repo.update()
    |> tap_ok(&broadcast("actors", {"actor:updated", &1}))
  end

  def delete_actor(%Actor{} = actor), do: Repo.delete(actor)

  def transition_phase(%Actor{} = actor, new_phase, reason \\ nil) do
    old_phase = actor.phase
    now = DateTime.utc_now()

    Ecto.Multi.new()
    |> Ecto.Multi.update(:actor, Actor.changeset(actor, %{phase: new_phase, phase_started_at: now}))
    |> Ecto.Multi.insert(:transition, PhaseTransition.changeset(%PhaseTransition{id: generate_id()}, %{
      actor_id: actor.id,
      from_phase: old_phase,
      to_phase: new_phase,
      reason: reason,
      inserted_at: now
    }))
    |> Repo.transaction()
    |> case do
      {:ok, %{actor: actor, transition: _}} ->
        broadcast("actors", {"actor:phase_changed", actor})
        {:ok, actor}
      {:error, _step, changeset, _changes} ->
        {:error, changeset}
    end
  end

  @doc "Record a phase transition from a params map (used by PhaseTransitionController)."
  def record_phase_transition(%{"actor_id" => actor_id, "to_phase" => to_phase} = params) do
    case get_actor(actor_id) do
      nil -> {:error, :not_found}
      actor -> transition_phase(actor, to_phase, params["reason"])
    end
  end

  def record_phase_transition(%{actor_id: actor_id, to_phase: to_phase} = params) do
    case get_actor(actor_id) do
      nil -> {:error, :not_found}
      actor -> transition_phase(actor, to_phase, Map.get(params, :reason))
    end
  end

  def list_phase_transitions(actor_id) do
    PhaseTransition
    |> where([t], t.actor_id == ^actor_id)
    |> order_by([t], desc: t.inserted_at)
    |> Repo.all()
  end

  # ── Tags ──

  def list_tags(opts \\ []) do
    query = Tag |> maybe_filter_space(opts[:space_id]) |> order_by([t], asc: t.name)

    if opts[:entity_type] || opts[:entity_id] || opts[:actor_id] do
      query
      |> join(:inner, [t], et in EntityTag, on: et.tag_id == t.id)
      |> maybe_where_field(:entity_type, opts[:entity_type])
      |> maybe_where_field(:entity_id, opts[:entity_id])
      |> maybe_where_actor(opts[:actor_id])
      |> Repo.all()
    else
      Repo.all(query)
    end
  end

  defp maybe_where_field(query, _field, nil), do: query
  defp maybe_where_field(query, :entity_type, val), do: where(query, [_t, et], et.entity_type == ^val)
  defp maybe_where_field(query, :entity_id, val), do: where(query, [_t, et], et.entity_id == ^val)

  defp maybe_where_actor(query, nil), do: query
  defp maybe_where_actor(query, actor_id), do: where(query, [_t, et], et.actor_id == ^actor_id)

  def get_tag(id), do: Repo.get(Tag, id)

  def create_tag(attrs) do
    %Tag{id: generate_id()}
    |> Tag.changeset(attrs)
    |> Repo.insert()
  end

  @doc "Tag an entity. Finds or creates the tag by name, then creates entity_tag link."
  def tag_entity(entity_type, entity_id, tag_name, actor_id \\ "human", _namespace \\ "default") do
    slug = tag_name |> String.downcase() |> String.replace(~r/[^a-z0-9]+/, "-") |> String.trim("-")

    tag =
      case Repo.get_by(Tag, slug: slug) do
        nil ->
          {:ok, t} = create_tag(%{name: tag_name, slug: slug})
          t
        existing -> existing
      end

    %EntityTag{id: generate_id()}
    |> EntityTag.changeset(%{tag_id: tag.id, entity_type: entity_type, entity_id: entity_id, actor_id: actor_id})
    |> Repo.insert(on_conflict: :nothing)
    |> case do
      {:ok, et} -> {:ok, Map.merge(Map.from_struct(et), %{tag: tag_name, namespace: "default"})}
      error -> error
    end
  end

  def untag_entity(entity_type, entity_id, tag_name, _actor_id \\ "human") do
    slug = tag_name |> String.downcase() |> String.replace(~r/[^a-z0-9]+/, "-") |> String.trim("-")

    case Repo.get_by(Tag, slug: slug) do
      nil -> {0, nil}
      tag ->
        EntityTag
        |> where([et], et.tag_id == ^tag.id and et.entity_type == ^entity_type and et.entity_id == ^entity_id)
        |> Repo.delete_all()
    end
  end

  def tags_for_entity(entity_type, entity_id) do
    Tag
    |> join(:inner, [t], et in EntityTag, on: et.tag_id == t.id)
    |> where([_t, et], et.entity_type == ^entity_type and et.entity_id == ^entity_id)
    |> Repo.all()
  end

  # ── Entity Data ──

  def get_data(actor_id, entity_type, entity_id, key) do
    EntityData
    |> where([d], d.actor_id == ^actor_id and d.entity_type == ^entity_type and d.entity_id == ^entity_id and d.key == ^key)
    |> Repo.one()
  end

  def set_data(actor_id, entity_type, entity_id, key, value) do
    attrs = %{actor_id: actor_id, entity_type: entity_type, entity_id: entity_id, key: key, value: value}

    %EntityData{id: generate_id()}
    |> EntityData.changeset(attrs)
    |> Repo.insert(
      on_conflict: {:replace, [:value, :updated_at]},
      conflict_target: [:actor_id, :entity_type, :entity_id, :key]
    )
  end

  def list_data(actor_id, entity_type, entity_id) do
    EntityData
    |> where([d], d.actor_id == ^actor_id and d.entity_type == ^entity_type and d.entity_id == ^entity_id)
    |> Repo.all()
  end

  def delete_data(actor_id, entity_type, entity_id, key) do
    EntityData
    |> where([d], d.actor_id == ^actor_id and d.entity_type == ^entity_type and d.entity_id == ^entity_id and d.key == ^key)
    |> Repo.delete_all()
  end

  # ── Container Config ──

  def get_config(container_type, container_id, key) do
    ContainerConfig
    |> where([c], c.container_type == ^container_type and c.container_id == ^container_id and c.key == ^key)
    |> Repo.one()
  end

  def set_config(container_type, container_id, key, value) do
    attrs = %{container_type: container_type, container_id: container_id, key: key, value: value}

    %ContainerConfig{id: generate_id()}
    |> ContainerConfig.changeset(attrs)
    |> Repo.insert(
      on_conflict: {:replace, [:value, :updated_at]},
      conflict_target: [:container_type, :container_id, :key]
    )
  end

  def list_config(container_type, container_id) do
    ContainerConfig
    |> where([c], c.container_type == ^container_type and c.container_id == ^container_id)
    |> Repo.all()
  end

  # ── Actor Commands ──

  def register_command(attrs) do
    %ActorCommand{id: generate_id()}
    |> ActorCommand.changeset(attrs)
    |> Repo.insert(on_conflict: :replace_all, conflict_target: [:actor_id, :command_name])
  end

  def unregister_command(actor_id, command_name) do
    ActorCommand
    |> where([c], c.actor_id == ^actor_id and c.command_name == ^command_name)
    |> Repo.delete_all()
  end

  def list_commands(actor_id) do
    ActorCommand
    |> where([c], c.actor_id == ^actor_id)
    |> order_by([c], asc: c.command_name)
    |> Repo.all()
  end

  def all_commands do
    ActorCommand
    |> preload(:actor)
    |> order_by([c], asc: c.command_name)
    |> Repo.all()
  end

  # ── Bootstrap ──

  def ensure_default_human_actor do
    case get_actor_by_slug("trajan") do
      nil ->
        create_actor(%{
          name: "Trajan",
          slug: "trajan",
          actor_type: "human",
          status: "active",
          phase: "idle"
        })
      actor -> {:ok, actor}
    end
  end

  # ── Private ──

  defp generate_id do
    :crypto.strong_rand_bytes(8) |> Base.url_encode64(padding: false)
  end

  defp maybe_filter_space(query, nil), do: query
  defp maybe_filter_space(query, space_id), do: where(query, [q], q.space_id == ^space_id)

  defp maybe_filter_type(query, nil), do: query
  defp maybe_filter_type(query, type), do: where(query, [q], q.actor_type == ^type)

  defp maybe_filter_status(query, nil), do: query
  defp maybe_filter_status(query, status), do: where(query, [q], q.status == ^status)

  defp broadcast(topic, message) do
    Phoenix.PubSub.broadcast(Ema.PubSub, topic, message)
  end

  defp tap_ok({:ok, record} = result, fun) do
    fun.(record)
    result
  end

  defp tap_ok(error, _fun), do: error
end
