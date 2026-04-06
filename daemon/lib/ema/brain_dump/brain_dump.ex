defmodule Ema.BrainDump do
  @moduledoc """
  Brain Dump — quick capture inbox for thoughts, ideas, and fleeting notes.
  Items flow: capture → inbox → process (to task/journal/note/archive).
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.BrainDump.Item

  def list_items(opts \\ []) do
    Item
    |> maybe_filter(:project_id, opts[:project_id])
    |> maybe_filter(:space_id, opts[:space_id])
    |> maybe_filter(:actor_id, opts[:actor_id])
    |> maybe_filter(:container_type, opts[:container_type])
    |> maybe_filter(:container_id, opts[:container_id])
    |> order_by(desc: :inserted_at)
    |> Repo.all()
  end

  def list_unprocessed do
    Item |> where([i], i.processed == false) |> order_by(asc: :inserted_at) |> Repo.all()
  end

  def unprocessed_count do
    Item |> where([i], i.processed == false) |> Repo.aggregate(:count)
  end

  def get_item(id), do: Repo.get(Item, id)

  def create_item(attrs) do
    id = generate_id()

    result =
      %Item{}
      |> Item.create_changeset(Map.put(attrs, :id, id))
      |> Repo.insert()

    case result do
      {:ok, item} ->
        unless test_env?() do
          # Async embedding for brain-dump-to-proposal clustering
          Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
            Ema.Vectors.Embedder.embed_brain_dump_item(item)
          end)

          Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
            project_path = File.cwd!()
            intent_slug = Ema.Executions.IntentFolder.slugify(String.slice(item.content, 0, 60))
            intent_path = ".superman/intents/#{intent_slug}"

            # Create intent folder on disk
            case Ema.Executions.IntentFolder.create(project_path, intent_slug, item.content) do
              :ok ->
                :ok

              {:error, reason} ->
                require Logger

                Logger.warning(
                  "[BrainDump] IntentFolder create failed for #{intent_slug}: #{inspect(reason)}"
                )
            end

            # Create execution with semantic anchor
            case Ema.Executions.create(%{
                   title: String.slice(item.content, 0, 120),
                   objective: item.content,
                   mode: "research",
                   status: "created",
                   brain_dump_item_id: item.id,
                   intent_slug: intent_slug,
                   intent_path: intent_path,
                   requires_approval: false
                 }) do
              {:ok, ex} ->
                # Auto-approve so dispatch_if_ready fires for requires_approval: false
                Ema.Executions.approve_execution(ex.id)

              {:error, reason} ->
                require Logger

                Logger.warning(
                  "[BrainDump] Failed to create execution for item #{item.id}: #{inspect(reason)}"
                )
            end
          end)
        end

        Ema.Pipes.EventBus.broadcast_event("brain_dump:item_created", %{
          item_id: item.id,
          content: item.content,
          source: item.source
        })

        {:ok, item}

      error ->
        error
    end
  end

  @doc """
  Create a brain dump item without triggering async execution creation,
  intent folder creation, or auto-approval. Used by the IntentionFarmer
  to load historical intents without spawning agent executions.
  """
  def create_item_quiet(attrs) do
    id = generate_id()

    result =
      %Item{}
      |> Item.create_changeset(Map.put(attrs, :id, id))
      |> Repo.insert()

    case result do
      {:ok, item} ->
        Ema.Pipes.EventBus.broadcast_event("brain_dump:item_created", %{
          item_id: item.id,
          content: item.content,
          source: item.source,
          quiet: true
        })

        {:ok, item}

      error ->
        error
    end
  end

  def process_item(id, action) when action in ~w(task journal archive note) do
    case get_item(id) do
      nil ->
        {:error, :not_found}

      item ->
        result =
          item
          |> Item.process_changeset(%{
            processed: true,
            action: action,
            processed_at: DateTime.utc_now()
          })
          |> Repo.update()

        case result do
          {:ok, processed} ->
            Ema.Pipes.EventBus.broadcast_event("brain_dump:item_processed", %{
              item_id: processed.id,
              action: action
            })

            {:ok, processed}

          error ->
            error
        end
    end
  end

  def move_to_processing(id) do
    case get_item(id) do
      nil -> {:error, :not_found}
      item -> item |> Ecto.Changeset.change(action: "processing") |> Repo.update()
    end
  end

  def unprocess_item(id) do
    case get_item(id) do
      nil ->
        {:error, :not_found}

      item ->
        item
        |> Ecto.Changeset.change(processed: false, action: nil, processed_at: nil)
        |> Repo.update()
    end
  end

  def delete_item(id) do
    case get_item(id) do
      nil -> {:error, :not_found}
      item -> Repo.delete(item)
    end
  end

  # --- Project linkage ---

  @doc """
  Link a brain dump item to an existing project.

  Sets `project_id` on the item. Returns `{:ok, item}` or `{:error, reason}`.
  """
  def link_to_project(brain_dump_id, project_id) do
    case get_item(brain_dump_id) do
      nil ->
        {:error, :not_found}

      item ->
        item
        |> Item.link_changeset(%{project_id: project_id})
        |> Repo.update()
    end
  end

  @doc """
  Seed a new Project from the content of a brain dump item using Claude.

  Asks Claude to derive a project name, slug, and description from the dump
  content, creates the project, then links the brain dump item to it.

  Returns `{:ok, project}` or `{:error, reason}`.
  """
  def seed_project_from_dump(brain_dump_id) do
    require Logger

    case get_item(brain_dump_id) do
      nil ->
        {:error, :not_found}

      item ->
        prompt = build_project_seed_prompt(item.content)

        case Ema.Claude.Bridge.run(prompt, task_type: "brain_dump_seed", agent_id: "brain_dump") do
          {:ok, result} ->
            text = extract_text_result(result)

            with {:ok, project_attrs} <- parse_project_from_response(text),
                 {:ok, project} <- Ema.Projects.create_project(project_attrs) do
              case link_to_project(brain_dump_id, project.id) do
                {:ok, _} ->
                  :ok

                {:error, reason} ->
                  Logger.warning(
                    "BrainDump.seed_project_from_dump: failed to link item #{brain_dump_id} " <>
                      "to project #{project.id}: #{inspect(reason)}"
                  )
              end

              Ema.Pipes.EventBus.broadcast_event("brain_dump:project_seeded", %{
                item_id: brain_dump_id,
                project_id: project.id
              })

              {:ok, project}
            else
              {:error, reason} ->
                Logger.warning(
                  "BrainDump.seed_project_from_dump: project creation failed: #{inspect(reason)}"
                )

                {:error, reason}
            end

          {:error, reason} ->
            Logger.warning(
              "BrainDump.seed_project_from_dump: Claude call failed: #{inspect(reason)}"
            )

            {:error, reason}
        end
    end
  end

  # --- Private helpers ---

  defp build_project_seed_prompt(content) do
    """
    You are EMA, an AI chief of staff. A user has submitted the following brain dump idea:

    ---
    #{content}
    ---

    Based on this, generate a project definition. Respond with ONLY valid JSON in this exact format:

    {
      "name": "Project Name",
      "slug": "project-slug",
      "description": "One or two sentence description of what this project is about."
    }

    Rules:
    - slug must be lowercase alphanumeric with hyphens only, max 40 chars
    - name should be concise (2-5 words)
    - description should capture the core intent
    - No extra text, only the JSON object
    """
  end

  defp extract_text_result(%{"content" => content}) when is_binary(content), do: content
  defp extract_text_result(%{content: content}) when is_binary(content), do: content
  defp extract_text_result(result) when is_binary(result), do: result
  defp extract_text_result(result), do: inspect(result)

  defp parse_project_from_response(text) do
    json_str =
      case Regex.run(~r/```(?:json)?\s*(\{.*?\})\s*```/ms, text, capture: :all_but_first) do
        [json] ->
          json

        _ ->
          case Regex.run(~r/(\{[^{}]+\})/ms, text, capture: :all_but_first) do
            [json] -> json
            _ -> text
          end
      end

    case Jason.decode(String.trim(json_str)) do
      {:ok, %{"name" => name, "slug" => slug, "description" => description}} ->
        {:ok, %{name: name, slug: slug, description: description, status: "incubating"}}

      {:ok, _} ->
        {:error, :invalid_project_json}

      {:error, reason} ->
        {:error, {:json_parse_error, reason}}
    end
  end

  defp generate_id do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "bd_#{timestamp}_#{random}"
  end

  defp maybe_filter(query, _field, nil), do: query
  defp maybe_filter(query, field, value), do: where(query, [i], field(i, ^field) == ^value)

  defp test_env?, do: Code.ensure_loaded?(Mix) and Mix.env() == :test
end
