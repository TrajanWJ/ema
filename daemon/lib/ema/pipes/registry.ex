defmodule Ema.Pipes.Registry do
  @moduledoc """
  Central registry of all triggers, actions, and transforms across EMA contexts.
  Maintains the catalog that the Pipes editor uses to show available nodes,
  and that the Executor uses to resolve action_id strings to executable functions.
  """

  use GenServer

  defmodule Trigger do
    @enforce_keys [:id, :context, :event_type, :label]
    defstruct [:id, :context, :event_type, :label, :schema, :description]
  end

  defmodule Action do
    @enforce_keys [:id, :context, :action_id, :label, :execute]
    defstruct [:id, :context, :action_id, :label, :schema, :description, :execute]
  end

  defmodule Transform do
    @enforce_keys [:id, :label, :type]
    defstruct [:id, :label, :type, :config, :description]
  end

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def list_triggers do
    GenServer.call(__MODULE__, :list_triggers)
  end

  def list_actions do
    GenServer.call(__MODULE__, :list_actions)
  end

  def list_transforms do
    GenServer.call(__MODULE__, :list_transforms)
  end

  def get_action(action_id) do
    case GenServer.call(__MODULE__, {:get_action, action_id}) do
      nil -> Ema.PluginRegistry.lookup_action(action_id)
      action -> action
    end
  end

  def execute_action(action_id, payload) do
    case get_action(action_id) do
      nil ->
        # Not in stock or plugin registry
        {:error, :unknown_action}

      %{source: :plugin} = plugin_action ->
        # Plugin action — dispatch via PluginRegistry
        Ema.PluginRegistry.dispatch_action(plugin_action.action_id, payload, %{})

      action ->
        action.execute.(payload)
    end
  end

  def get_trigger(trigger_id) do
    GenServer.call(__MODULE__, {:get_trigger, trigger_id})
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    state = %{
      triggers: stock_triggers(),
      actions: stock_actions(),
      transforms: stock_transforms()
    }

    {:ok, state}
  end

  @impl true
  def handle_call(:list_triggers, _from, state) do
    {:reply, state.triggers, state}
  end

  def handle_call(:list_actions, _from, state) do
    {:reply, state.actions, state}
  end

  def handle_call(:list_transforms, _from, state) do
    {:reply, state.transforms, state}
  end

  def handle_call({:get_action, action_id}, _from, state) do
    action = Enum.find(state.actions, &(&1.action_id == action_id))
    {:reply, action, state}
  end

  def handle_call({:get_trigger, trigger_id}, _from, state) do
    trigger = Enum.find(state.triggers, &(&1.id == trigger_id))
    {:reply, trigger, state}
  end

  # --- Stock Triggers ---

  defp stock_triggers do
    [
      # Brain Dump
      %Trigger{
        id: "brain_dump:item_created",
        context: "brain_dump",
        event_type: "item_created",
        label: "Brain Dump Item Created",
        description: "New capture added"
      },
      %Trigger{
        id: "brain_dump:item_processed",
        context: "brain_dump",
        event_type: "item_processed",
        label: "Brain Dump Item Processed",
        description: "Item routed to task/journal/note/archive"
      },

      # Tasks
      %Trigger{
        id: "tasks:created",
        context: "tasks",
        event_type: "created",
        label: "Task Created",
        description: "New task from any source"
      },
      %Trigger{
        id: "tasks:status_changed",
        context: "tasks",
        event_type: "status_changed",
        label: "Task Status Changed",
        description: "Task status transition"
      },
      %Trigger{
        id: "tasks:completed",
        context: "tasks",
        event_type: "completed",
        label: "Task Completed",
        description: "Task marked done"
      },

      # Proposals
      %Trigger{
        id: "proposals:seed_fired",
        context: "proposals",
        event_type: "seed_fired",
        label: "Seed Fired",
        description: "A seed was triggered"
      },
      %Trigger{
        id: "proposals:generated",
        context: "proposals",
        event_type: "generated",
        label: "Proposal Generated",
        description: "Raw proposal created by generator"
      },
      %Trigger{
        id: "proposals:refined",
        context: "proposals",
        event_type: "refined",
        label: "Proposal Refined",
        description: "Proposal passed through refiner"
      },
      %Trigger{
        id: "proposals:debated",
        context: "proposals",
        event_type: "debated",
        label: "Proposal Debated",
        description: "Proposal passed through debater"
      },
      %Trigger{
        id: "proposals:queued",
        context: "proposals",
        event_type: "queued",
        label: "Proposal Queued",
        description: "Proposal arrived in queue"
      },
      %Trigger{
        id: "proposals:approved",
        context: "proposals",
        event_type: "approved",
        label: "Proposal Approved",
        description: "User green-lit a proposal"
      },
      %Trigger{
        id: "proposals:redirected",
        context: "proposals",
        event_type: "redirected",
        label: "Proposal Redirected",
        description: "User yellow-lit a proposal"
      },
      %Trigger{
        id: "proposals:killed",
        context: "proposals",
        event_type: "killed",
        label: "Proposal Killed",
        description: "User red-lit a proposal"
      },

      # Projects
      %Trigger{
        id: "projects:created",
        context: "projects",
        event_type: "created",
        label: "Project Created",
        description: "New project"
      },
      %Trigger{
        id: "projects:status_changed",
        context: "projects",
        event_type: "status_changed",
        label: "Project Status Changed",
        description: "Project lifecycle transition"
      },

      # Habits
      %Trigger{
        id: "habits:completed",
        context: "habits",
        event_type: "completed",
        label: "Habit Completed",
        description: "Habit checked off"
      },
      %Trigger{
        id: "habits:streak_milestone",
        context: "habits",
        event_type: "streak_milestone",
        label: "Habit Streak Milestone",
        description: "Streak hit 7/30/100"
      },

      # System
      %Trigger{
        id: "system:daemon_started",
        context: "system",
        event_type: "daemon_started",
        label: "Daemon Started",
        description: "Daemon boot"
      },
      %Trigger{
        id: "system:daily",
        context: "system",
        event_type: "daily",
        label: "Daily Tick",
        description: "Fires once per day"
      },
      %Trigger{
        id: "system:weekly",
        context: "system",
        event_type: "weekly",
        label: "Weekly Tick",
        description: "Fires once per week"
      }
    ]
  end

  # --- Stock Actions ---

  defp stock_actions do
    [
      # Brain Dump
      %Action{
        id: "brain_dump:create_item",
        context: "brain_dump",
        action_id: "brain_dump:create_item",
        label: "Create Brain Dump Item",
        description: "Add a capture",
        schema: %{content: :string, source: :string},
        execute: fn payload ->
          Ema.BrainDump.create_item(%{
            content: payload["content"] || payload[:content],
            source: payload["source"] || payload[:source] || "pipe"
          })
        end
      },

      # Tasks — use dynamic dispatch since the full Tasks context may not exist yet
      %Action{
        id: "tasks:create",
        context: "tasks",
        action_id: "tasks:create",
        label: "Create Task",
        description: "Create a new task",
        schema: %{title: :string, project_id: :string, priority: :integer},
        execute: fn payload ->
          safe_apply(Ema.Tasks, :create_task, [
            %{
              title: payload["title"] || payload[:title],
              project_id: payload["project_id"] || payload[:project_id],
              priority: payload["priority"] || payload[:priority],
              source_type: payload["source_type"] || payload[:source_type] || "pipe",
              source_id: payload["source_id"] || payload[:source_id]
            }
          ])
        end
      },
      %Action{
        id: "tasks:transition",
        context: "tasks",
        action_id: "tasks:transition",
        label: "Transition Task Status",
        description: "Change task status",
        schema: %{task_id: :string, status: :string},
        execute: fn payload ->
          task_id = payload["task_id"] || payload[:task_id]
          status = payload["status"] || payload[:status]

          case safe_apply(Ema.Tasks, :get_task, [task_id]) do
            {:ok, nil} -> {:error, :not_found}
            {:ok, task} -> safe_apply(Ema.Tasks, :transition_status, [task, status])
            error -> error
          end
        end
      },

      # Proposals
      %Action{
        id: "proposals:create_seed",
        context: "proposals",
        action_id: "proposals:create_seed",
        label: "Create Proposal Seed",
        description: "Create a new seed prompt",
        schema: %{prompt: :string, project_id: :string},
        execute: fn payload ->
          safe_apply(Ema.Proposals, :create_seed, [
            %{
              prompt: payload["prompt"] || payload[:prompt],
              project_id: payload["project_id"] || payload[:project_id]
            }
          ])
        end
      },
      %Action{
        id: "proposals:approve",
        context: "proposals",
        action_id: "proposals:approve",
        label: "Approve Proposal",
        description: "Green-light a proposal",
        schema: %{proposal_id: :string},
        execute: fn payload ->
          proposal_id = payload["proposal_id"] || payload[:proposal_id]
          safe_apply(Ema.Proposals, :approve_proposal, [proposal_id])
        end
      },
      %Action{
        id: "proposals:redirect",
        context: "proposals",
        action_id: "proposals:redirect",
        label: "Redirect Proposal",
        description: "Yellow-light a proposal",
        schema: %{proposal_id: :string, note: :string},
        execute: fn payload ->
          proposal_id = payload["proposal_id"] || payload[:proposal_id]
          note = payload["note"] || payload[:note] || ""
          safe_apply(Ema.Proposals, :redirect_proposal, [proposal_id, note])
        end
      },
      %Action{
        id: "proposals:kill",
        context: "proposals",
        action_id: "proposals:kill",
        label: "Kill Proposal",
        description: "Red-light a proposal",
        schema: %{proposal_id: :string},
        execute: fn payload ->
          proposal_id = payload["proposal_id"] || payload[:proposal_id]
          safe_apply(Ema.Proposals, :kill_proposal, [proposal_id])
        end
      },

      # Projects — use dynamic dispatch since the full Projects context may not exist yet
      %Action{
        id: "projects:create",
        context: "projects",
        action_id: "projects:create",
        label: "Create Project",
        description: "Create a new project",
        schema: %{name: :string, slug: :string},
        execute: fn payload ->
          safe_apply(Ema.Projects, :create_project, [
            %{
              name: payload["name"] || payload[:name],
              slug: payload["slug"] || payload[:slug],
              description: payload["description"] || payload[:description]
            }
          ])
        end
      },
      %Action{
        id: "projects:transition",
        context: "projects",
        action_id: "projects:transition",
        label: "Transition Project Status",
        description: "Change project status",
        schema: %{project_id: :string, status: :string},
        execute: fn payload ->
          project_id = payload["project_id"] || payload[:project_id]
          status = payload["status"] || payload[:status]

          case safe_apply(Ema.Projects, :get_project, [project_id]) do
            {:ok, nil} -> {:error, :not_found}
            {:ok, project} -> safe_apply(Ema.Projects, :transition_status, [project, status])
            error -> error
          end
        end
      },
      %Action{
        id: "projects:rebuild_context",
        context: "projects",
        action_id: "projects:rebuild_context",
        label: "Rebuild Project Context",
        description: "Force context document rebuild",
        schema: %{project_id: :string},
        execute: fn payload ->
          project_id = payload["project_id"] || payload[:project_id]

          case safe_apply(Ema.Projects, :get_project, [project_id]) do
            {:ok, nil} ->
              {:error, :not_found}

            {:ok, project} ->
              # Rebuild context by re-fetching all fragments; this triggers
              # ContextIndexer to re-derive and store updated embeddings.
              ctx = Ema.Projects.get_context(project.id)

              Phoenix.PubSub.broadcast(
                Ema.PubSub,
                "projects:context",
                {:context_rebuilt, project_id, ctx}
              )

              {:ok, %{project_id: project_id, rebuilt: true}}

            error ->
              error
          end
        end
      },

      # Responsibilities
      %Action{
        id: "responsibilities:generate_due_tasks",
        context: "responsibilities",
        action_id: "responsibilities:generate_due_tasks",
        label: "Generate Due Tasks",
        description: "Generate tasks from due responsibilities",
        schema: %{},
        execute: fn _payload ->
          safe_apply(Ema.Responsibilities, :generate_due_tasks, [])
        end
      },

      # Vault
      %Action{
        id: "vault:create_project_space",
        context: "vault",
        action_id: "vault:create_project_space",
        label: "Create Project Vault Space",
        description: "Bootstrap vault directory for new project",
        schema: %{project_id: :string},
        execute: fn payload ->
          project_id = payload["project_id"] || payload[:project_id]

          case safe_apply(Ema.Projects, :get_project, [project_id]) do
            {:ok, nil} ->
              {:error, :not_found}

            {:ok, project} ->
              vault_root = Ema.SecondBrain.vault_root()
              slug = project.slug || project_id
              project_dir = Path.join([vault_root, "projects", slug])
              subdirs = ["specs", "decisions", "notes", "context"]

              results =
                [project_dir | Enum.map(subdirs, &Path.join(project_dir, &1))]
                |> Enum.map(fn dir ->
                  case File.mkdir_p(dir) do
                    :ok -> {:ok, dir}
                    {:error, reason} -> {:error, {dir, reason}}
                  end
                end)

              errors = Enum.filter(results, &match?({:error, _}, &1))

              if Enum.empty?(errors) do
                {:ok,
                 %{project_id: project_id, vault_path: project_dir, dirs_created: length(results)}}
              else
                {:error, {:partial, errors}}
              end

            error ->
              error
          end
        end
      },
      %Action{
        id: "vault:create_note",
        context: "vault",
        action_id: "vault:create_note",
        label: "Create Vault Note",
        description: "Create a note in the vault",
        schema: %{title: :string, content: :string, space: :string},
        execute: fn payload ->
          safe_apply(Ema.SecondBrain, :create_note, [
            %{
              title: payload["title"] || payload[:title],
              content: payload["content"] || payload[:content],
              space: payload["space"] || payload[:space]
            }
          ])
        end
      },

      # Notifications
      %Action{
        id: "notify:desktop",
        context: "notify",
        action_id: "notify:desktop",
        label: "Desktop Notification",
        description: "Send a desktop notification",
        schema: %{title: :string, body: :string},
        execute: fn payload ->
          title = payload["title"] || payload[:title] || "EMA"

          body =
            payload["body"] || payload[:body] || payload["message"] || payload[:message] || ""

          urgency = payload["urgency"] || payload[:urgency] || "normal"
          require Logger

          # Attempt notify-send (Linux), fall back to a log entry
          case System.find_executable("notify-send") do
            nil ->
              Logger.info("[notify:desktop] #{title}: #{body}")
              {:ok, :logged}

            bin ->
              {output, exit_code} =
                System.cmd(bin, ["--urgency=#{urgency}", title, body], stderr_to_stdout: true)

              if exit_code == 0 do
                {:ok, :sent}
              else
                Logger.warning("[notify:desktop] notify-send failed (#{exit_code}): #{output}")
                {:ok, :fallback_logged}
              end
          end
        end
      },
      %Action{
        id: "notify:log",
        context: "notify",
        action_id: "notify:log",
        label: "Log Message",
        description: "Write to system log",
        schema: %{message: :string, level: :string},
        execute: fn payload ->
          message = payload["message"] || payload[:message] || "pipe event"
          level_str = payload["level"] || payload[:level] || "info"
          require Logger

          valid_levels = %{
            "emergency" => :emergency,
            "alert" => :alert,
            "critical" => :critical,
            "error" => :error,
            "warning" => :warning,
            "notice" => :notice,
            "info" => :info,
            "debug" => :debug
          }

          level = Map.get(valid_levels, level_str, :info)
          Logger.log(level, "Pipe: #{message}")
          {:ok, :logged}
        end
      },

      # Claude AI (Intelligence Layer)
      %Action{
        id: "claude:run",
        context: "claude",
        action_id: "claude:run",
        label: "Run Claude AI",
        description: "Send payload through Claude via the Intelligence Router",
        schema: %{
          prompt_template: :string,
          event_keys: {:array, :string},
          model: :string,
          event_type: :string
        },
        execute: fn payload ->
          config = %{
            "prompt_template" => payload["prompt_template"] || "Process this: {{content}}",
            "event_keys" => payload["event_keys"] || [],
            "model" => payload["model"],
            "event_type" => payload["event_type"] || "general"
          }

          Ema.Pipes.Actions.ClaudeAction.execute(payload, config)
        end
      },

      # Vault Search
      %Action{
        id: "vault:search",
        context: "vault",
        action_id: "vault:search",
        label: "Search Vault",
        description: "Full-text search the second brain / vault",
        schema: %{query_template: :string, limit: :integer, space: :string},
        execute: fn payload ->
          config = %{
            "query_template" => payload["query_template"] || "{{content}}",
            "limit" => payload["limit"] || 10,
            "space" => payload["space"]
          }

          Ema.Pipes.Actions.VaultSearchAction.execute(payload, config)
        end
      },

      # HTTP Request
      %Action{
        id: "http:request",
        context: "http",
        action_id: "http:request",
        label: "HTTP Request",
        description: "Make an outbound HTTP request",
        schema: %{url: :string, method: :string, body_template: :string, response_key: :string},
        execute: fn payload ->
          config = %{
            "url" => payload["url"],
            "method" => payload["method"] || "get",
            "headers" => payload["headers"] || %{},
            "body_template" => payload["body_template"],
            "response_key" => payload["response_key"] || "http_response"
          }

          Ema.Pipes.Actions.HttpRequestAction.execute(payload, config)
        end
      },

      # Transform
      %Action{
        id: "transform",
        context: "transform",
        action_id: "transform",
        label: "Transform Payload",
        description: "Manipulate pipe payload fields (set/copy/delete/template/rename)",
        schema: %{operations: {:array, :map}},
        execute: fn payload ->
          config = %{"operations" => payload["operations"] || []}
          Ema.Pipes.Actions.TransformAction.execute(payload, config)
        end
      },

      # Branch
      %Action{
        id: "branch",
        context: "branch",
        action_id: "branch",
        label: "Branch",
        description: "Conditional branching based on payload field value",
        schema: %{condition: :map, if_true: :string, if_false: :string},
        execute: fn payload ->
          config = %{
            "condition" => payload["condition"] || %{},
            "if_true" => payload["if_true"],
            "if_false" => payload["if_false"]
          }

          Ema.Pipes.Actions.BranchAction.execute(payload, config)
        end
      },

      # Notify
      %Action{
        id: "notify:send",
        context: "notify",
        action_id: "notify:send",
        label: "Send Notification",
        description: "Send a notification via discord, telegram, or pubsub",
        schema: %{channel: :string, target: :string, message_template: :string},
        execute: fn payload ->
          config = %{
            "channel" => payload["channel"] || "pubsub",
            "target" => payload["target"],
            "message_template" => payload["message_template"] || "{{content}}"
          }

          Ema.Pipes.Actions.NotifyAction.execute(payload, config)
        end
      }
    ]
  end

  # --- Stock Transforms ---

  defp stock_transforms do
    [
      %Transform{
        id: "filter",
        label: "Filter",
        type: :filter,
        description: "Pass/drop events based on conditions"
      },
      %Transform{
        id: "map",
        label: "Map",
        type: :map,
        description: "Reshape payload before passing to actions"
      },
      %Transform{
        id: "delay",
        label: "Delay",
        type: :delay,
        description: "Debounce — accumulate events, fire after quiet period"
      },
      %Transform{
        id: "claude",
        label: "Claude",
        type: :claude,
        description: "Run Claude CLI as a transform"
      },
      %Transform{
        id: "conditional",
        label: "Conditional",
        type: :conditional,
        description: "Branch logic — if/then/else"
      }
    ]
  end

  # Dynamic dispatch that handles missing modules gracefully.
  # Returns {:ok, result} on success or {:error, reason} if module/function unavailable.
  defp safe_apply(module, function, args) do
    if Code.ensure_loaded?(module) and function_exported?(module, function, length(args)) do
      result = apply(module, function, args)

      case result do
        {:ok, _} = ok -> ok
        {:error, _} = err -> err
        other -> {:ok, other}
      end
    else
      {:error, {:not_implemented, "#{inspect(module)}.#{function}/#{length(args)}"}}
    end
  end
end
