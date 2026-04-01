defmodule Ema.Agents.AgentWorker do
  @moduledoc """
  Per-agent GenServer that handles message routing, prompt building,
  Claude CLI invocation, and tool execution.
  """

  use GenServer
  require Logger

  alias Ema.Agents
  alias Ema.Claude.Runner

  # --- Public API ---

  def start_link(agent_id) do
    GenServer.start_link(__MODULE__, agent_id, name: via(agent_id))
  end

  def send_message(agent_id, conversation_id, content, metadata \\ %{}) do
    GenServer.call(via(agent_id), {:message, conversation_id, content, metadata}, 180_000)
  end

  @doc "Send a message and route the response to the originating channel type."
  def send_and_route(agent_id, conversation_id, content, metadata \\ %{}) do
    case send_message(agent_id, conversation_id, content, metadata) do
      {:ok, result} ->
        channel_type = Map.get(metadata, :channel_type, Map.get(metadata, "channel_type"))
        channel_id = Map.get(metadata, :channel_id, Map.get(metadata, "channel_id"))

        # Broadcast the response so channels and unified inbox pick it up
        Phoenix.PubSub.broadcast(Ema.PubSub, "channels:messages", %{
          event: :agent_response,
          agent_id: agent_id,
          conversation_id: conversation_id,
          channel_type: channel_type,
          channel_id: channel_id,
          reply: result.reply,
          tool_calls: result.tool_calls,
          timestamp: DateTime.utc_now()
        })

        {:ok, result}

      error ->
        error
    end
  end

  def get_state(agent_id) do
    GenServer.call(via(agent_id), :get_state)
  end

  @doc "Check if this agent should autonomously respond to a message based on personality/config."
  def should_respond?(agent_id, message_content, channel_type) do
    case Registry.lookup(Ema.Agents.Registry, {:worker, agent_id}) do
      [{_pid, _}] ->
        state = get_state(agent_id)
        agent = state.agent
        settings = agent.settings || %{}

        # Agent responds if: active, channel is in auto_respond list, and content matches triggers
        agent.status == "active" &&
          channel_type in Map.get(settings, "auto_respond_channels", ["webchat"]) &&
          matches_triggers?(message_content, Map.get(settings, "triggers", []))

      [] ->
        false
    end
  end

  defp matches_triggers?(_content, []), do: true

  defp matches_triggers?(content, triggers) when is_list(triggers) do
    lowered = String.downcase(content)
    Enum.any?(triggers, fn trigger -> String.contains?(lowered, String.downcase(trigger)) end)
  end

  defp via(agent_id) do
    {:via, Registry, {Ema.Agents.Registry, {:worker, agent_id}}}
  end

  # --- Callbacks ---

  @impl true
  def init(agent_id) do
    case Agents.get_agent(agent_id) do
      nil ->
        {:stop, {:agent_not_found, agent_id}}

      agent ->
        Logger.info("AgentWorker started for #{agent.slug} (#{agent_id})")

        {:ok,
         %{
           agent_id: agent_id,
           agent: agent,
           script: load_script(agent.script_path)
         }}
    end
  end

  @impl true
  def handle_call({:message, conversation_id, content, metadata}, _from, state) do
    case handle_message(conversation_id, content, metadata, state) do
      {:ok, response} -> {:reply, {:ok, response}, state}
      {:error, reason} -> {:reply, {:error, reason}, state}
    end
  end

  def handle_call(:get_state, _from, state) do
    {:reply, state, state}
  end

  @impl true
  def handle_info(:reload, state) do
    case Agents.get_agent(state.agent_id) do
      nil ->
        {:stop, :agent_deleted, state}

      agent ->
        {:noreply, %{state | agent: agent, script: load_script(agent.script_path)}}
    end
  end

  # --- Internal ---

  defp handle_message(conversation_id, content, metadata, state) do
    agent = state.agent

    # Store the user message
    case Agents.add_message(%{
           conversation_id: conversation_id,
           role: "user",
           content: content,
           metadata: metadata
         }) do
      {:ok, _user_msg} -> :ok
      {:error, reason} -> Logger.warning("Failed to store user message: #{inspect(reason)}")
    end

    # Build prompt from script + conversation history
    prompt = build_prompt(state, conversation_id, content)

    # Call Claude CLI
    case Runner.run(prompt,
           model: agent.model,
           max_tokens: agent.max_tokens,
           project_path: project_path(agent)
         ) do
      {:ok, response_text} ->
        {reply, tool_calls} = parse_response(response_text)

        # Execute tool calls if present
        tool_results = execute_tool_calls(tool_calls, agent)

        # If there were tool calls, build a follow-up with results
        final_reply =
          if tool_results != [] do
            build_tool_followup(reply, tool_results)
          else
            reply
          end

        # Store assistant message
        case Agents.add_message(%{
               conversation_id: conversation_id,
               role: "assistant",
               content: final_reply,
               tool_calls: tool_calls,
               metadata: %{}
             }) do
          {:ok, _assistant_msg} ->
            :ok

          {:error, reason} ->
            Logger.warning("Failed to store assistant message: #{inspect(reason)}")
        end

        # Notify memory GenServer about the new messages
        notify_memory(state.agent_id, conversation_id)

        {:ok, %{reply: final_reply, tool_calls: tool_calls, tool_results: tool_results}}

      {:error, reason} ->
        Logger.error("Claude CLI failed for agent #{agent.slug}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp build_prompt(state, conversation_id, _current_content) do
    parts = []

    # System prompt from script
    parts =
      if state.script do
        parts ++ ["[System]\n#{state.script}\n"]
      else
        parts ++ ["[System]\nYou are #{state.agent.name}. #{state.agent.description || ""}\n"]
      end

    # Conversation history
    messages = Agents.list_messages_by_conversation(conversation_id)

    history =
      Enum.map(messages, fn msg ->
        role_label = String.capitalize(msg.role)
        "[#{role_label}]\n#{msg.content}"
      end)

    parts = parts ++ history

    Enum.join(parts, "\n\n")
  end

  defp load_script(nil), do: nil

  defp load_script(path) do
    case File.read(path) do
      {:ok, content} -> content
      {:error, _} -> nil
    end
  end

  defp project_path(%{project_id: nil}), do: nil

  defp project_path(%{project_id: project_id}) do
    case Ema.Projects.get_project(project_id) do
      %{linked_path: path} when is_binary(path) and path != "" -> path
      _ -> nil
    end
  end

  defp parse_response(response) when is_binary(response) do
    {response, []}
  end

  defp parse_response(%{"content" => content, "tool_calls" => tool_calls})
       when is_list(tool_calls) do
    {content, tool_calls}
  end

  defp parse_response(%{"content" => content}) do
    {content, []}
  end

  defp parse_response(response) when is_map(response) do
    {inspect(response), []}
  end

  defp execute_tool_calls([], _agent), do: []

  defp execute_tool_calls(tool_calls, agent) do
    allowed_tools = MapSet.new(agent.tools || [])

    Enum.map(tool_calls, fn call ->
      tool_name = Map.get(call, "name", Map.get(call, :name, "unknown"))
      input = Map.get(call, "input", Map.get(call, :input, %{}))

      if MapSet.member?(allowed_tools, tool_name) do
        execute_tool(tool_name, input)
      else
        %{tool: tool_name, error: "Tool not allowed for this agent"}
      end
    end)
  end

  defp execute_tool(tool_name, input) do
    case tool_name do
      "brain_dump:create_item" ->
        case Ema.BrainDump.create_item(input) do
          {:ok, item} -> %{tool: tool_name, result: %{id: item.id}}
          {:error, reason} -> %{tool: tool_name, error: inspect(reason)}
        end

      _ ->
        %{tool: tool_name, error: "Tool not implemented: #{tool_name}"}
    end
  end

  defp build_tool_followup(reply, tool_results) do
    results_text =
      Enum.map_join(tool_results, "\n", fn result ->
        case result do
          %{tool: tool, result: res} -> "[Tool #{tool}]: #{inspect(res)}"
          %{tool: tool, error: err} -> "[Tool #{tool} error]: #{err}"
        end
      end)

    "#{reply}\n\n---\nTool results:\n#{results_text}"
  end

  defp notify_memory(agent_id, conversation_id) do
    case Registry.lookup(Ema.Agents.Registry, {:memory, agent_id}) do
      [{pid, _}] ->
        send(pid, {:check_conversation, conversation_id})

      [] ->
        :ok
    end
  end
end
