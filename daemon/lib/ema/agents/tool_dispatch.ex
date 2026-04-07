defmodule Ema.Agents.ToolDispatch do
  @moduledoc "Routes agent tool calls to EMA domain functions via direct Elixir calls."

  def execute(tool_name, input) do
    dispatch(tool_name, input)
  end

  defp dispatch("brain_dump:create_item", input) do
    case Ema.BrainDump.create_item(input) do
      {:ok, item} -> {:ok, %{id: item.id, content: item.content}}
      error -> error
    end
  end

  defp dispatch("task:create", input) do
    case Ema.Tasks.create_task(input) do
      {:ok, task} -> {:ok, %{id: task.id, title: task.title, status: task.status}}
      error -> error
    end
  end

  defp dispatch("task:update", input) do
    id = input["id"] || input[:id]

    case Ema.Tasks.get_task(id) do
      nil ->
        {:error, "Task not found: #{id}"}

      task ->
        case Ema.Tasks.update_task(task, Map.drop(input, ["id", :id])) do
          {:ok, t} -> {:ok, %{id: t.id, title: t.title, status: t.status}}
          error -> error
        end
    end
  end

  defp dispatch("vault:search", input) do
    query = input["query"] || input[:query] || ""
    results = Ema.SecondBrain.search_brain(query)
    {:ok, %{results: results, count: length(results)}}
  rescue
    e -> {:error, Exception.message(e)}
  end

  defp dispatch("vault:read", input) do
    path = input["path"] || input[:path]

    case Ema.SecondBrain.get_note_by_path(path) do
      nil -> {:error, "Note not found: #{path}"}
      note -> {:ok, %{path: note.file_path, title: note.title}}
    end
  end

  defp dispatch("vault:write", input) do
    case Ema.SecondBrain.create_note(input) do
      {:ok, note} -> {:ok, %{id: note.id, path: note.file_path}}
      error -> error
    end
  end

  defp dispatch("goal:create", input) do
    case Ema.Goals.create_goal(input) do
      {:ok, goal} -> {:ok, %{id: goal.id, title: goal.title}}
      error -> error
    end
  end

  defp dispatch("execution:create", input) do
    case Ema.Executions.create(input) do
      {:ok, exec} -> {:ok, %{id: exec.id, status: exec.status}}
      error -> error
    end
  end

  defp dispatch("intent:create", input) do
    case Ema.Intents.create_intent(input) do
      {:ok, intent} -> {:ok, %{id: intent.id, title: intent.title}}
      error -> error
    end
  end

  defp dispatch("proposal:create", input) do
    case Ema.Proposals.create_proposal(input) do
      {:ok, proposal} -> {:ok, %{id: proposal.id, title: proposal.title}}
      error -> error
    end
  end

  # Fallback: delegate any ema_* tool to MCP DomainTools (60+ tools)
  defp dispatch("ema_" <> _ = name, input) do
    Ema.MCP.DomainTools.call(name, input, nil)
  end

  defp dispatch(name, _input), do: {:error, "Unknown tool: #{name}"}
end
