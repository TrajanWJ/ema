defmodule Ema.Agents.AgentWorker do
  @moduledoc """
  Per-agent GenServer that handles message routing, prompt building,
  Claude CLI invocation, and tool execution.
  """

  use GenServer
  require Logger

  alias Ema.Agents
  alias Ema.Claude.Bridge
  alias Ema.Claude.Adapters.OpenClaw, as: OpenClawAdapter
  alias Ema.Claude.ContextInjector
  alias Ema.Intelligence.BudgetEnforcer
  alias Ema.Intelligence.VaultLearner

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

  def dispatch_to_domain(agent_slug, user_message, context \\ %{}) do
    with :ok <- BudgetEnforcer.check(),
         {:ok, agent} <- fetch_agent(agent_slug),
         requested_keys <-
           context
           |> requested_context_keys()
           |> Kernel.++(tool_context_keys(agent))
           |> Enum.uniq(),
         {:ok, system_prompt} <- load_system_prompt(agent),
         {:ok, injected_context} <-
           ContextInjector.build_context(
             %{type: :domain_request, agent: agent_slug, message: user_message},
             requested_keys
           ),
         full_prompt <-
           build_domain_prompt(system_prompt, user_message, Map.merge(injected_context, context)),
         {:ok, response} <-
           Bridge.run(
             full_prompt,
             model: agent.model,
             max_tokens: agent.max_tokens,
             temperature: agent.temperature,
             session_id: "domain-#{agent_slug}",
             agent_id: agent.id,
             task_type: "domain_dispatch"
           ) do
      text = extract_bridge_text(response)

      VaultLearner.schedule_learning(%{
        agent: agent_slug |> to_string() |> String.to_atom(),
        task_type: Map.get(context, :type, Map.get(context, "type", :general)),
        campaign_id: Map.get(context, :campaign_id, Map.get(context, "campaign_id")),
        response_text: extract_response_text(response),
        session_id: "dispatch-#{agent_slug}-#{System.system_time(:millisecond)}"
      })

      {:ok, text}
    end
  end

  @doc """
  Non-blocking version of `dispatch_to_domain/3`.

  Retains the synchronous API for direct HTTP/chat callers, but allows
  background dispatch when the caller only needs eventual delivery.
  """
  def dispatch_to_domain_async(agent_slug, user_message, context \\ %{}, on_complete \\ nil) do
    with :ok <- BudgetEnforcer.check(),
         {:ok, agent} <- fetch_agent(agent_slug),
         requested_keys <-
           context
           |> requested_context_keys()
           |> Kernel.++(tool_context_keys(agent))
           |> Enum.uniq(),
         {:ok, system_prompt} <- load_system_prompt(agent),
         {:ok, injected_context} <-
           ContextInjector.build_context(
             %{type: :domain_request, agent: agent_slug, message: user_message},
             requested_keys
           ) do
      full_prompt =
        build_domain_prompt(system_prompt, user_message, Map.merge(injected_context, context))

      callback = fn
        {:ok, response} ->
          text = extract_bridge_text(response)

          VaultLearner.schedule_learning(%{
            agent: agent_slug |> to_string() |> String.to_atom(),
            task_type: Map.get(context, :type, Map.get(context, "type", :general)),
            campaign_id: Map.get(context, :campaign_id, Map.get(context, "campaign_id")),
            response_text: extract_response_text(response),
            session_id: "dispatch-#{agent_slug}-#{System.system_time(:millisecond)}"
          })

          if is_function(on_complete, 1), do: on_complete.({:ok, text})

        {:error, reason} ->
          if is_function(on_complete, 1), do: on_complete.({:error, reason})
      end

      Bridge.run_async(
        full_prompt,
        [
          model: agent.model,
          max_tokens: agent.max_tokens,
          temperature: agent.temperature,
          session_id: "domain-#{agent_slug}",
          agent_id: agent.id,
          task_type: "domain_dispatch"
        ],
        callback
      )
    end
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

  defp fetch_agent(slug) do
    case Agents.get_agent_by_slug(slug) do
      nil -> {:error, :agent_not_found}
      agent -> {:ok, agent}
    end
  end

  defp load_system_prompt(%{script_path: nil}), do: {:ok, ""}

  defp load_system_prompt(%{script_path: path}) do
    full_path =
      path
      |> String.replace_prefix("priv/", "")
      |> then(&Path.join(:code.priv_dir(:ema), &1))

    case File.read(full_path) do
      {:ok, content} -> {:ok, content}
      {:error, _reason} -> {:ok, ""}
    end
  end

  defp tool_context_keys(agent) do
    agent.tools
    |> List.wrap()
    |> Enum.map(&tool_to_context_key/1)
    |> Enum.reject(&is_nil/1)
  end

  defp tool_to_context_key("goal_context"), do: :goals
  defp tool_to_context_key("project_context"), do: :project
  defp tool_to_context_key("task_context"), do: :tasks
  defp tool_to_context_key("vault_read"), do: :vault
  defp tool_to_context_key("context_summary"), do: :proposals
  defp tool_to_context_key(_tool), do: nil

  defp requested_context_keys(context) when is_map(context) do
    context
    |> Map.keys()
    |> Enum.map(fn
      key when is_atom(key) -> key
      "project" -> :project
      "goals" -> :goals
      "tasks" -> :tasks
      "vault" -> :vault
      "energy" -> :energy
      "proposals" -> :proposals
      _ -> nil
    end)
    |> Enum.reject(&is_nil/1)
  end

  defp build_domain_prompt(system_prompt, user_message, context) do
    """
    #{system_prompt}

    ## Current Context
    #{inspect(context, pretty: true, limit: :infinity)}

    ## User Request
    #{user_message}
    """
  end

  defp extract_bridge_text(%{"result" => result}) when is_binary(result), do: result
  defp extract_bridge_text(%{"content" => result}) when is_binary(result), do: result
  defp extract_bridge_text(%{text: result}) when is_binary(result), do: result
  defp extract_bridge_text(%{"text" => result}) when is_binary(result), do: result
  defp extract_bridge_text(result) when is_binary(result), do: result
  defp extract_bridge_text(result), do: inspect(result)

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

    # Route to appropriate backend
    settings = agent.settings || %{}

    case Map.get(settings, "backend") do
      "openclaw" ->
        handle_openclaw_message(agent, conversation_id, content, settings)

      _ ->
        handle_runner_message(state, agent, conversation_id, content)
    end
  end

  defp handle_openclaw_message(agent, conversation_id, content, settings) do
    openclaw_agent_id = Map.get(settings, "openclaw_agent_id", "main")

    case OpenClawAdapter.run(content, openclaw_agent_id) do
      {:ok, %{text: text}} ->
        # Store assistant message
        Agents.add_message(%{
          conversation_id: conversation_id,
          role: "assistant",
          content: text,
          metadata: %{"backend" => "openclaw", "agent" => openclaw_agent_id}
        })

        notify_memory(agent.id, conversation_id)
        {:ok, %{reply: text, tool_calls: [], tool_results: []}}

      {:error, reason} ->
        Logger.error("OpenClaw failed for agent #{agent.slug}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp handle_runner_message(state, agent, conversation_id, content) do
    # Build prompt from script + conversation history
    prompt = build_prompt(state, conversation_id, content)

    # Call Claude CLI
    case Bridge.run(prompt, model: agent.model) do
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

  # TODO: wire up when agent execution needs project working directory
  # defp project_path(%{project_id: nil}), do: nil
  # defp project_path(%{project_id: project_id}) do
  #   case Ema.Projects.get_project(project_id) do
  #     %{linked_path: path} when is_binary(path) and path != "" -> path
  #     _ -> nil
  #   end
  # end

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

  defp extract_response_text(response) when is_binary(response), do: response
  defp extract_response_text(%{text: t}) when is_binary(t), do: t
  defp extract_response_text(%{"content" => t}) when is_binary(t), do: t
  defp extract_response_text(%{content: t}) when is_binary(t), do: t
  defp extract_response_text(r), do: inspect(r)

  defp notify_memory(agent_id, conversation_id) do
    case Registry.lookup(Ema.Agents.Registry, {:memory, agent_id}) do
      [{pid, _}] ->
        send(pid, {:check_conversation, conversation_id})

      [] ->
        :ok
    end
  end
end
