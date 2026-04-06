defmodule Ema.Actors do
  @moduledoc """
  Context module for the Actor/Container model.

  Actors are first-class participants (human or agent) with their own
  executive management state, phase cadence, and capabilities.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Actors.{Actor, Tag, EntityData, ContainerConfig, PhaseTransition, ActorCommand}

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

  def transition_phase(%Actor{} = actor, new_phase, opts \\ []) do
    old_phase = actor.phase
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    reason = if is_binary(opts), do: opts, else: opts[:reason]
    summary = if is_list(opts), do: opts[:summary]
    space_id = if(is_list(opts), do: opts[:space_id]) || actor.space_id
    project_id = if is_list(opts), do: opts[:project_id]
    week_number = if is_list(opts), do: opts[:week_number]

    Ecto.Multi.new()
    |> Ecto.Multi.update(:actor, Actor.changeset(actor, %{phase: new_phase, phase_started_at: now}))
    |> Ecto.Multi.insert(:transition, PhaseTransition.changeset(%PhaseTransition{id: generate_id()}, %{
      actor_id: actor.id,
      space_id: space_id,
      project_id: project_id,
      from_phase: old_phase,
      to_phase: new_phase,
      week_number: week_number,
      reason: reason,
      summary: summary,
      transitioned_at: now
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
      actor ->
        transition_phase(actor, to_phase,
          reason: params["reason"],
          summary: params["summary"],
          space_id: params["space_id"],
          project_id: params["project_id"],
          week_number: params["week_number"] && String.to_integer("#{params["week_number"]}")
        )
    end
  end

  def record_phase_transition(%{actor_id: actor_id, to_phase: to_phase} = params) do
    case get_actor(actor_id) do
      nil -> {:error, :not_found}
      actor ->
        transition_phase(actor, to_phase,
          reason: Map.get(params, :reason),
          summary: Map.get(params, :summary),
          space_id: Map.get(params, :space_id),
          project_id: Map.get(params, :project_id),
          week_number: Map.get(params, :week_number)
        )
    end
  end

  def list_phase_transitions(actor_id) do
    PhaseTransition
    |> where([t], t.actor_id == ^actor_id)
    |> order_by([t], desc: t.inserted_at)
    |> Repo.all()
  end

  # ── Tags (flat schema: one row per entity+tag+actor) ──

  def list_tags(opts \\ []) do
    Tag
    |> maybe_filter_tag(:entity_type, opts[:entity_type])
    |> maybe_filter_tag(:entity_id, opts[:entity_id])
    |> maybe_filter_tag(:actor_id, opts[:actor_id])
    |> maybe_filter_tag(:namespace, opts[:namespace])
    |> order_by([t], desc: t.inserted_at)
    |> Repo.all()
  end

  def get_tag(id), do: Repo.get(Tag, id)

  def tag_entity(entity_type, entity_id, tag_name, actor_id \\ "human", namespace \\ "default") do
    %Tag{id: generate_id()}
    |> Tag.changeset(%{
      entity_type: entity_type,
      entity_id: entity_id,
      tag: tag_name,
      actor_id: actor_id,
      namespace: namespace
    })
    |> Repo.insert(on_conflict: :nothing, conflict_target: [:entity_type, :entity_id, :tag, :actor_id])
  end

  def untag_entity(entity_type, entity_id, tag_name, actor_id \\ "human") do
    Tag
    |> where([t], t.entity_type == ^entity_type and t.entity_id == ^entity_id and t.tag == ^tag_name and t.actor_id == ^actor_id)
    |> Repo.delete_all()
  end

  def tags_for_entity(entity_type, entity_id) do
    Tag
    |> where([t], t.entity_type == ^entity_type and t.entity_id == ^entity_id)
    |> order_by([t], asc: t.tag)
    |> Repo.all()
  end

  defp maybe_filter_tag(query, _field, nil), do: query
  defp maybe_filter_tag(query, :entity_type, val), do: where(query, [t], t.entity_type == ^val)
  defp maybe_filter_tag(query, :entity_id, val), do: where(query, [t], t.entity_id == ^val)
  defp maybe_filter_tag(query, :actor_id, val), do: where(query, [t], t.actor_id == ^val)
  defp maybe_filter_tag(query, :namespace, val), do: where(query, [t], t.namespace == ^val)

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
