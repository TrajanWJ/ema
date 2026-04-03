defmodule Ema.BrainDump do
  @moduledoc """
  Brain Dump — quick capture inbox for thoughts, ideas, and fleeting notes.
  Items flow: capture → inbox → process (to task/journal/note/archive).
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.BrainDump.Item

  def list_items do
    Item |> order_by(desc: :inserted_at) |> Repo.all()
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
        Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
          project_path = File.cwd!()
          intent_slug = Ema.Executions.IntentFolder.slugify(String.slice(item.content, 0, 60))
          intent_path = ".superman/intents/#{intent_slug}"

          # Create intent folder on disk
          case Ema.Executions.IntentFolder.create(project_path, intent_slug, item.content) do
            :ok -> :ok
            {:error, reason} ->
              require Logger
              Logger.warning("[BrainDump] IntentFolder create failed for #{intent_slug}: #{inspect(reason)}")
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
              Logger.warning("[BrainDump] Failed to create execution for item #{item.id}: #{inspect(reason)}")
          end
        end)
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

  defp generate_id do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "bd_#{timestamp}_#{random}"
  end
end
