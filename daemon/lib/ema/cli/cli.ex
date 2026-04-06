defmodule Ema.CLI do
  @moduledoc "EMA CLI entry point — Optimus-based arg parsing with transport resolution."

  alias Ema.CLI.{Output, Transport}

  @version "3.0.0"
  @builtin_roots ~w(
    task proposal vault focus agent exec goal brain-dump habit journal resp seed engine
    pipe campaign evolution channel project babysitter session watch superman metamind
    ralph vectors quality dispatch-board tokens config em tag data canvas note voice
    org actor space intent gap integration reflexion ai-session routing git-sync tunnel
    file-vault messages team-pulse metrics feedback dashboard dump status
  )
  @actor_dispatch_switches [json: :boolean, host: :string, actor: :string, space: :string, project: :string, task: :string]
  @actor_dispatch_aliases [j: :json, H: :host, a: :actor, s: :space, p: :project, t: :task]

  def main(["mcp-serve" | _]) do
    {:ok, _} = Application.ensure_all_started(:req)
    Ema.CLI.Commands.McpServe.handle([], %{}, nil, %{})
  end

  def main(args) do
    {:ok, _} = Application.ensure_all_started(:req)

    case maybe_dispatch_actor_command(args) do
      :continue ->
        optimus = build_optimus()

        case Optimus.parse(optimus, args) do
      {:ok, [:task | sub], parsed} ->
        dispatch(:task, sub, parsed)

      {:ok, [:proposal | sub], parsed} ->
        dispatch(:proposal, sub, parsed)

      {:ok, [:vault | sub], parsed} ->
        dispatch(:vault, sub, parsed)

      {:ok, [:focus | sub], parsed} ->
        dispatch(:focus, sub, parsed)

      {:ok, [:agent | sub], parsed} ->
        dispatch(:agent, sub, parsed)

      {:ok, [:exec | sub], parsed} ->
        dispatch(:exec, sub, parsed)

      {:ok, [:goal | sub], parsed} ->
        dispatch(:goal, sub, parsed)

      {:ok, [:"brain-dump" | sub], parsed} ->
        dispatch(:brain_dump, sub, parsed)

      {:ok, [:habit | sub], parsed} ->
        dispatch(:habit, sub, parsed)

      {:ok, [:journal | sub], parsed} ->
        dispatch(:journal, sub, parsed)

      {:ok, [:resp | sub], parsed} ->
        dispatch(:resp, sub, parsed)

      {:ok, [:seed | sub], parsed} ->
        dispatch(:seed, sub, parsed)

      {:ok, [:engine | sub], parsed} ->
        dispatch(:engine, sub, parsed)

      {:ok, [:pipe | sub], parsed} ->
        dispatch(:pipe, sub, parsed)

      {:ok, [:campaign | sub], parsed} ->
        dispatch(:campaign, sub, parsed)

      {:ok, [:evolution | sub], parsed} ->
        dispatch(:evolution, sub, parsed)

      {:ok, [:channel | sub], parsed} ->
        dispatch(:channel, sub, parsed)

      {:ok, [:project | sub], parsed} ->
        dispatch(:project, sub, parsed)

      {:ok, [:babysitter | sub], parsed} ->
        dispatch(:babysitter, sub, parsed)

      {:ok, [:session | sub], parsed} ->
        dispatch(:session, sub, parsed)

      {:ok, [:watch], parsed} ->
        dispatch(:watch, [], parsed)

      {:ok, [:superman | sub], parsed} ->
        dispatch(:superman, sub, parsed)

      {:ok, [:metamind | sub], parsed} ->
        dispatch(:metamind, sub, parsed)

      {:ok, [:ralph | sub], parsed} ->
        dispatch(:ralph, sub, parsed)

      {:ok, [:vectors | sub], parsed} ->
        dispatch(:vectors, sub, parsed)

      {:ok, [:quality | sub], parsed} ->
        dispatch(:quality, sub, parsed)

      {:ok, [:"dispatch-board" | sub], parsed} ->
        dispatch(:dispatch_board, sub, parsed)

      {:ok, [:tokens | sub], parsed} ->
        dispatch(:tokens, sub, parsed)

      {:ok, [:config | sub], parsed} ->
        dispatch(:config, sub, parsed)

      {:ok, [:em | sub], parsed} ->
        dispatch(:em, sub, parsed)

      {:ok, [:tag | sub], parsed} ->
        dispatch(:tag, sub, parsed)

      {:ok, [:data | sub], parsed} ->
        dispatch(:data, sub, parsed)

      {:ok, [:canvas | sub], parsed} ->
        dispatch(:canvas, sub, parsed)

      {:ok, [:note | sub], parsed} ->
        dispatch(:note, sub, parsed)

      {:ok, [:voice | sub], parsed} ->
        dispatch(:voice, sub, parsed)

      {:ok, [:org | sub], parsed} ->
        dispatch(:org, sub, parsed)

      {:ok, [:actor | sub], parsed} ->
        dispatch(:actor, sub, parsed)

      {:ok, [:space | sub], parsed} ->
        dispatch(:space, sub, parsed)

      {:ok, [:intent | sub], parsed} ->
        dispatch(:intent, sub, parsed)

      {:ok, [:gap | sub], parsed} ->
        dispatch(:gap, sub, parsed)

      {:ok, [:integration | sub], parsed} ->
        dispatch(:integration, sub, parsed)

      {:ok, [:reflexion | sub], parsed} ->
        dispatch(:reflexion, sub, parsed)

      {:ok, [:"ai-session" | sub], parsed} ->
        dispatch(:ai_session, sub, parsed)

      {:ok, [:routing | sub], parsed} ->
        dispatch(:routing, sub, parsed)

      {:ok, [:"git-sync" | sub], parsed} ->
        dispatch(:git_sync, sub, parsed)

      {:ok, [:tunnel | sub], parsed} ->
        dispatch(:tunnel, sub, parsed)

      {:ok, [:"file-vault" | sub], parsed} ->
        dispatch(:file_vault, sub, parsed)

      {:ok, [:messages | sub], parsed} ->
        dispatch(:messages, sub, parsed)

      {:ok, [:"team-pulse" | sub], parsed} ->
        dispatch(:team_pulse, sub, parsed)

      {:ok, [:metrics | sub], parsed} ->
        dispatch(:metrics, sub, parsed)

      {:ok, [:feedback | sub], parsed} ->
        dispatch(:feedback, sub, parsed)

      {:ok, [:dashboard], parsed} ->
        dispatch(:dashboard, [], parsed)

      {:ok, [:dump], parsed} ->
        dispatch(:dump, [], parsed)

      {:ok, [:status], parsed} ->
        dispatch(:status, [], parsed)

      :help ->
        Optimus.Help.help(optimus, [], columns()) |> put_lines()

      :version ->
        IO.puts("ema #{@version}")

      {:help, path} ->
        Optimus.Help.help(optimus, path, columns()) |> put_lines()

      {:error, errors} ->
        Enum.each(List.wrap(errors), &Output.error/1)
        System.halt(1)

      {:error, _path, errors} ->
        Enum.each(List.wrap(errors), &Output.error/1)
        System.halt(1)

          _ ->
            Output.error("Unknown command. Run 'ema --help' for usage.")
            System.halt(1)
        end

      {:halt, code} ->
        System.halt(code)
    end
  end

  defp dispatch(command, sub, parsed) do
    transport = Transport.resolve(host: parsed.options[:host])
    json? = parsed.flags[:json] || false
    opts = Map.merge(parsed.options, %{json: json?})

    case command do
      :task -> Ema.CLI.Commands.Task.handle(sub, parsed, transport, opts)
      :proposal -> Ema.CLI.Commands.Proposal.handle(sub, parsed, transport, opts)
      :vault -> Ema.CLI.Commands.Vault.handle(sub, parsed, transport, opts)
      :focus -> Ema.CLI.Commands.Focus.handle(sub, parsed, transport, opts)
      :agent -> Ema.CLI.Commands.Agent.handle(sub, parsed, transport, opts)
      :exec -> Ema.CLI.Commands.Exec.handle(sub, parsed, transport, opts)
      :goal -> Ema.CLI.Commands.Goal.handle(sub, parsed, transport, opts)
      :brain_dump -> Ema.CLI.Commands.BrainDump.handle(sub, parsed, transport, opts)
      :habit -> Ema.CLI.Commands.Habit.handle(sub, parsed, transport, opts)
      :journal -> Ema.CLI.Commands.Journal.handle(sub, parsed, transport, opts)
      :resp -> Ema.CLI.Commands.Responsibility.handle(sub, parsed, transport, opts)
      :seed -> Ema.CLI.Commands.Seed.handle(sub, parsed, transport, opts)
      :engine -> Ema.CLI.Commands.Engine.handle(sub, parsed, transport, opts)
      :pipe -> Ema.CLI.Commands.Pipe.handle(sub, parsed, transport, opts)
      :campaign -> Ema.CLI.Commands.Campaign.handle(sub, parsed, transport, opts)
      :evolution -> Ema.CLI.Commands.Evolution.handle(sub, parsed, transport, opts)
      :channel -> Ema.CLI.Commands.Channel.handle(sub, parsed, transport, opts)
      :project -> Ema.CLI.Commands.Project.handle(sub, parsed, transport, opts)
      :babysitter -> Ema.CLI.Commands.Babysitter.handle(sub, parsed, transport, opts)
      :session -> Ema.CLI.Commands.Session.handle(sub, parsed, transport, opts)
      :superman -> Ema.CLI.Commands.Superman.handle(sub, parsed, transport, opts)
      :metamind -> Ema.CLI.Commands.Metamind.handle(sub, parsed, transport, opts)
      :ralph -> Ema.CLI.Commands.Ralph.handle(sub, parsed, transport, opts)
      :vectors -> Ema.CLI.Commands.Vectors.handle(sub, parsed, transport, opts)
      :quality -> Ema.CLI.Commands.Quality.handle(sub, parsed, transport, opts)
      :dispatch_board -> Ema.CLI.Commands.DispatchBoard.handle(sub, parsed, transport, opts)
      :tokens -> Ema.CLI.Commands.Tokens.handle(sub, parsed, transport, opts)
      :config -> Ema.CLI.Commands.Config.handle(sub, parsed, transport, opts)
      :em -> Ema.CLI.Commands.Em.handle(sub, parsed, transport, opts)
      :tag -> Ema.CLI.Commands.Tag.handle(sub, parsed, transport, opts)
      :data -> Ema.CLI.Commands.Data.handle(sub, parsed, transport, opts)
      :canvas -> Ema.CLI.Commands.Canvas.handle(sub, parsed, transport, opts)
      :note -> Ema.CLI.Commands.Note.handle(sub, parsed, transport, opts)
      :voice -> Ema.CLI.Commands.Voice.handle(sub, parsed, transport, opts)
      :org -> Ema.CLI.Commands.Org.handle(sub, parsed, transport, opts)
      :actor -> Ema.CLI.Commands.Actor.handle(sub, parsed, transport, opts)
      :space -> Ema.CLI.Commands.Space.handle(sub, parsed, transport, opts)
      :intent -> Ema.CLI.Commands.Intent.handle(sub, parsed, transport, opts)
      :gap -> Ema.CLI.Commands.Gap.handle(sub, parsed, transport, opts)
      :integration -> Ema.CLI.Commands.Integration.handle(sub, parsed, transport, opts)
      :reflexion -> Ema.CLI.Commands.Reflexion.handle(sub, parsed, transport, opts)
      :ai_session -> Ema.CLI.Commands.AiSession.handle(sub, parsed, transport, opts)
      :routing -> Ema.CLI.Commands.Routing.handle(sub, parsed, transport, opts)
      :git_sync -> Ema.CLI.Commands.GitSync.handle(sub, parsed, transport, opts)
      :tunnel -> Ema.CLI.Commands.Tunnel.handle(sub, parsed, transport, opts)
      :file_vault -> Ema.CLI.Commands.FileVault.handle(sub, parsed, transport, opts)
      :messages -> Ema.CLI.Commands.Messages.handle(sub, parsed, transport, opts)
      :team_pulse -> Ema.CLI.Commands.TeamPulse.handle(sub, parsed, transport, opts)
      :metrics -> Ema.CLI.Commands.Metrics.handle(sub, parsed, transport, opts)
      :feedback -> Ema.CLI.Commands.Feedback.handle(sub, parsed, transport, opts)
      :dashboard -> Ema.CLI.Commands.Dashboard.handle(sub, parsed, transport, opts)
      :watch -> Ema.CLI.Commands.Watch.handle(sub, parsed, transport, opts)
      :dump -> Ema.CLI.Commands.Dump.handle(sub, parsed, transport, opts)
      :status -> Ema.CLI.Commands.Status.handle(sub, parsed, transport, opts)
    end
  end

  defp build_optimus do
    Optimus.new!(
      name: "ema",
      description: "EMA — Executive Management Assistant",
      version: @version,
      about: "Operator CLI for the EMA daemon",
      allow_unknown_args: false,
      parse_double_dash: true,
      flags: [
        json: [short: "-j", long: "--json", help: "Output as JSON", global: true]
      ],
      options: [
        host: [
          short: "-H",
          long: "--host",
          help: "Daemon URL (default: localhost:4488)",
          parser: :string,
          global: true
        ]
      ],
      subcommands: [
        task: task_spec(),
        proposal: proposal_spec(),
        vault: vault_spec(),
        focus: focus_spec(),
        agent: agent_spec(),
        exec: exec_spec(),
        goal: goal_spec(),
        "brain-dump": brain_dump_spec(),
        habit: habit_spec(),
        journal: journal_spec(),
        resp: resp_spec(),
        seed: seed_spec(),
        engine: engine_spec(),
        pipe: pipe_spec(),
        campaign: campaign_spec(),
        evolution: evolution_spec(),
        channel: channel_spec(),
        project: project_spec(),
        babysitter: babysitter_spec(),
        session: session_spec(),
        superman: superman_spec(),
        metamind: metamind_spec(),
        ralph: ralph_spec(),
        vectors: vectors_spec(),
        quality: quality_spec(),
        "dispatch-board": dispatch_board_spec(),
        tokens: tokens_spec(),
        config: config_spec(),
        em: em_spec(),
        tag: tag_spec(),
        data: data_spec(),
        canvas: canvas_spec(),
        note: note_spec(),
        voice: voice_spec(),
        org: org_spec(),
        integration: integration_spec(),
        reflexion: reflexion_spec(),
        "ai-session": ai_session_spec(),
        routing: routing_spec(),
        "git-sync": git_sync_spec(),
        tunnel: tunnel_spec(),
        "file-vault": file_vault_spec(),
        messages: messages_spec(),
        "team-pulse": team_pulse_spec(),
        metrics: metrics_spec(),
        feedback: feedback_spec(),
        dashboard: dashboard_spec(),
        actor: actor_spec(),
        space: space_spec(),
        intent: intent_spec(),
        gap: gap_spec(),
        watch: watch_spec(),
        dump: dump_spec(),
        status: status_spec()
      ]
    )
  end

  defp task_spec do
    [
      name: "task",
      about: "Task management",
      subcommands: [
        list: [
          name: "list",
          about: "List tasks",
          options: [
            status: [short: "-s", long: "--status", help: "Filter by status", parser: :string],
            actor: [short: "-a", long: "--actor", help: "Filter by actor ID", parser: :string],
            space: [long: "--space", help: "Filter by space ID", parser: :string],
            project: [
              short: "-p",
              long: "--project",
              help: "Filter by project ID",
              parser: :string
            ],
            limit: [short: "-l", long: "--limit", help: "Max results", parser: :integer]
          ]
        ],
        show: [
          name: "show",
          about: "Show task detail",
          args: [id: [required: true, help: "Task ID", parser: :integer]]
        ],
        create: [
          name: "create",
          about: "Create a task",
          args: [title: [required: true, help: "Task title"]],
          options: [
            project: [
              short: "-p",
              long: "--project",
              help: "Project ID",
              parser: :string
            ],
            actor: [short: "-a", long: "--actor", help: "Actor ID", parser: :string],
            space: [long: "--space", help: "Space ID", parser: :string],
            priority: [long: "--priority", help: "Priority (1-5)", parser: :integer],
            description: [short: "-d", long: "--description", help: "Description", parser: :string]
          ]
        ],
        update: [
          name: "update",
          about: "Update a task",
          args: [id: [required: true, help: "Task ID", parser: :integer]],
          options: [
            title: [long: "--title", help: "New title", parser: :string],
            status: [short: "-s", long: "--status", help: "New status", parser: :string],
            priority: [long: "--priority", help: "New priority", parser: :integer],
            description: [short: "-d", long: "--description", help: "Description", parser: :string]
          ]
        ],
        transition: [
          name: "transition",
          about: "Transition task to new status",
          args: [
            id: [required: true, help: "Task ID", parser: :integer],
            status: [required: true, help: "Target status"]
          ]
        ],
        delete: [
          name: "delete",
          about: "Delete a task",
          args: [id: [required: true, help: "Task ID", parser: :integer]]
        ]
      ]
    ]
  end

  defp proposal_spec do
    [
      name: "proposal",
      about: "Proposal lifecycle",
      subcommands: [
        list: [
          name: "list",
          about: "List proposals",
          options: [
            status: [short: "-s", long: "--status", help: "Filter by status", parser: :string],
            actor: [short: "-a", long: "--actor", help: "Filter by actor ID", parser: :string],
            space: [long: "--space", help: "Filter by space ID", parser: :string],
            project: [
              short: "-p",
              long: "--project",
              help: "Filter by project ID",
              parser: :string
            ],
            limit: [short: "-l", long: "--limit", help: "Max results", parser: :integer]
          ]
        ],
        show: [
          name: "show",
          about: "Show proposal detail",
          args: [id: [required: true, help: "Proposal ID", parser: :integer]]
        ],
        approve: [
          name: "approve",
          about: "Approve a proposal (creates execution)",
          args: [id: [required: true, help: "Proposal ID", parser: :integer]]
        ],
        kill: [
          name: "kill",
          about: "Kill a proposal",
          args: [id: [required: true, help: "Proposal ID", parser: :integer]]
        ],
        redirect: [
          name: "redirect",
          about: "Redirect a proposal (creates 3 seed angles)",
          args: [id: [required: true, help: "Proposal ID", parser: :integer]],
          options: [
            note: [short: "-n", long: "--note", help: "Redirect note", parser: :string]
          ]
        ],
        lineage: [
          name: "lineage",
          about: "Show proposal lineage tree",
          args: [id: [required: true, help: "Proposal ID", parser: :integer]]
        ]
      ]
    ]
  end

  defp vault_spec do
    [
      name: "vault",
      about: "Knowledge vault (Second Brain)",
      subcommands: [
        search: [
          name: "search",
          about: "Search vault notes",
          args: [query: [required: true, help: "Search query"]],
          options: [
            limit: [short: "-l", long: "--limit", help: "Max results", parser: :integer]
          ]
        ],
        tree: [
          name: "tree",
          about: "Show vault directory tree"
        ],
        read: [
          name: "read",
          about: "Read a vault note",
          args: [path: [required: true, help: "Note path (relative to vault root)"]]
        ],
        write: [
          name: "write",
          about: "Create or update a vault note",
          args: [path: [required: true, help: "Note path"]],
          options: [
            content: [short: "-c", long: "--content", help: "Note content", parser: :string]
          ],
          flags: [
            stdin: [long: "--stdin", help: "Read content from stdin"]
          ]
        ],
        graph: [
          name: "graph",
          about: "Show vault link graph stats"
        ],
        backlinks: [
          name: "backlinks",
          about: "Show backlinks for a note",
          args: [id: [required: true, help: "Note ID", parser: :integer]]
        ]
      ]
    ]
  end

  defp focus_spec do
    [
      name: "focus",
      about: "Focus timer",
      subcommands: [
        start: [
          name: "start",
          about: "Start a focus session",
          options: [
            duration: [
              short: "-d",
              long: "--duration",
              help: "Duration in minutes (default: 25)",
              parser: :integer
            ],
            task: [short: "-t", long: "--task", help: "Link to task ID", parser: :integer]
          ]
        ],
        stop: [name: "stop", about: "Stop current focus session"],
        pause: [name: "pause", about: "Pause current session"],
        resume: [name: "resume", about: "Resume paused session"],
        current: [name: "current", about: "Show active focus session"],
        today: [name: "today", about: "Today's focus stats"],
        weekly: [name: "weekly", about: "This week's focus stats"]
      ]
    ]
  end

  defp agent_spec do
    [
      name: "agent",
      about: "Agent management and chat",
      subcommands: [
        list: [name: "list", about: "List all agents"],
        show: [
          name: "show",
          about: "Show agent detail",
          args: [slug: [required: true, help: "Agent slug"]]
        ],
        chat: [
          name: "chat",
          about: "Chat with an agent",
          args: [
            slug: [required: true, help: "Agent slug"],
            message: [required: true, help: "Message to send"]
          ],
          options: [
            context: [long: "--context", help: "Additional context", parser: :string]
          ]
        ],
        conversations: [
          name: "conversations",
          about: "List agent conversations",
          args: [slug: [required: true, help: "Agent slug"]]
        ]
      ]
    ]
  end

  defp exec_spec do
    [
      name: "exec",
      about: "Execution lifecycle",
      subcommands: [
        list: [
          name: "list",
          about: "List executions",
          options: [
            status: [short: "-s", long: "--status", help: "Filter by status", parser: :string],
            project: [short: "-p", long: "--project", help: "Filter by project", parser: :string],
            actor: [short: "-a", long: "--actor", help: "Reserved actor scope", parser: :string],
            space: [long: "--space", help: "Reserved space scope", parser: :string],
            limit: [short: "-l", long: "--limit", help: "Max results", parser: :integer]
          ]
        ],
        show: [
          name: "show",
          about: "Show execution detail",
          args: [id: [required: true, help: "Execution ID"]]
        ],
        create: [
          name: "create",
          about: "Create execution",
          args: [objective: [required: true, help: "Execution objective"]],
          options: [
            title: [long: "--title", help: "Title", parser: :string],
            mode: [short: "-m", long: "--mode", help: "Mode (research/implement/review)", parser: :string],
            project: [short: "-p", long: "--project", help: "Project slug", parser: :string],
            actor: [short: "-a", long: "--actor", help: "Reserved actor scope", parser: :string],
            space: [long: "--space", help: "Reserved space scope", parser: :string]
          ]
        ],
        approve: [
          name: "approve",
          about: "Approve execution",
          args: [id: [required: true, help: "Execution ID"]]
        ],
        cancel: [
          name: "cancel",
          about: "Cancel execution",
          args: [id: [required: true, help: "Execution ID"]]
        ],
        events: [
          name: "events",
          about: "List execution events",
          args: [id: [required: true, help: "Execution ID"]]
        ]
      ]
    ]
  end

  defp goal_spec do
    [
      name: "goal",
      about: "Goal tracking",
      subcommands: [
        list: [
          name: "list",
          about: "List goals",
          options: [
            status: [short: "-s", long: "--status", help: "Filter by status", parser: :string],
            timeframe: [long: "--timeframe", help: "Filter by timeframe", parser: :string],
            actor: [short: "-a", long: "--actor", help: "Filter by actor ID", parser: :string],
            space: [long: "--space", help: "Filter by space ID", parser: :string],
            project: [short: "-p", long: "--project", help: "Filter by project", parser: :string]
          ]
        ],
        show: [
          name: "show",
          about: "Show goal detail (with children)",
          args: [id: [required: true, help: "Goal ID"]]
        ],
        create: [
          name: "create",
          about: "Create a goal",
          args: [title: [required: true, help: "Goal title"]],
          options: [
            description: [short: "-d", long: "--description", help: "Description", parser: :string],
            status: [short: "-s", long: "--status", help: "Status (default: active)", parser: :string],
            timeframe: [long: "--timeframe", help: "Timeframe", parser: :string],
            parent: [long: "--parent", help: "Parent goal ID", parser: :string],
            actor: [short: "-a", long: "--actor", help: "Actor ID", parser: :string],
            space: [long: "--space", help: "Space ID", parser: :string],
            project: [short: "-p", long: "--project", help: "Project ID", parser: :string]
          ]
        ],
        update: [
          name: "update",
          about: "Update a goal",
          args: [id: [required: true, help: "Goal ID"]],
          options: [
            title: [long: "--title", help: "New title", parser: :string],
            status: [short: "-s", long: "--status", help: "New status", parser: :string],
            description: [short: "-d", long: "--description", help: "Description", parser: :string],
            timeframe: [long: "--timeframe", help: "Timeframe", parser: :string]
          ]
        ],
        delete: [
          name: "delete",
          about: "Delete a goal",
          args: [id: [required: true, help: "Goal ID"]]
        ]
      ]
    ]
  end

  defp brain_dump_spec do
    [
      name: "brain-dump",
      about: "Brain dump inbox management",
      subcommands: [
        list: [
          name: "list",
          about: "List all items",
          options: [
            actor: [short: "-a", long: "--actor", help: "Filter by actor ID", parser: :string],
            space: [long: "--space", help: "Filter by space ID", parser: :string],
            project: [short: "-p", long: "--project", help: "Filter by project ID", parser: :string],
            task: [short: "-t", long: "--task", help: "Filter by task ID", parser: :string]
          ]
        ],
        unprocessed: [name: "unprocessed", about: "List unprocessed items"],
        create: [
          name: "create",
          about: "Create brain dump item",
          args: [content: [required: true, help: "Item content"]],
          options: [
            actor: [short: "-a", long: "--actor", help: "Actor ID", parser: :string],
            space: [long: "--space", help: "Space ID", parser: :string],
            project: [short: "-p", long: "--project", help: "Project ID", parser: :string],
            task: [short: "-t", long: "--task", help: "Task ID", parser: :string]
          ]
        ],
        process: [
          name: "process",
          about: "Mark item as processed",
          args: [id: [required: true, help: "Item ID"]],
          options: [
            action: [short: "-a", long: "--action", help: "Action (task|journal|archive|note)", parser: :string]
          ]
        ],
        delete: [
          name: "delete",
          about: "Delete item",
          args: [id: [required: true, help: "Item ID"]]
        ]
      ]
    ]
  end

  defp habit_spec do
    [
      name: "habit",
      about: "Habit tracking",
      subcommands: [
        list: [name: "list", about: "List active habits"],
        create: [
          name: "create",
          about: "Create habit",
          args: [name: [required: true, help: "Habit name"]],
          options: [
            cadence: [long: "--cadence", help: "Cadence (daily/weekly/monthly)", parser: :string]
          ]
        ],
        toggle: [
          name: "toggle",
          about: "Toggle habit completion for date",
          args: [id: [required: true, help: "Habit ID"]],
          options: [
            date: [long: "--date", help: "Date (YYYY-MM-DD, default: today)", parser: :string]
          ]
        ],
        today: [name: "today", about: "Today's habit checklist"],
        archive: [
          name: "archive",
          about: "Archive a habit",
          args: [id: [required: true, help: "Habit ID"]]
        ]
      ]
    ]
  end

  defp journal_spec do
    [
      name: "journal",
      about: "Daily journal",
      subcommands: [
        read: [
          name: "read",
          about: "Read journal entry",
          options: [
            date: [long: "--date", help: "Date (YYYY-MM-DD, default: today)", parser: :string]
          ]
        ],
        write: [
          name: "write",
          about: "Write/update journal entry",
          args: [content: [required: true, help: "Entry content"]],
          options: [
            date: [long: "--date", help: "Date (YYYY-MM-DD, default: today)", parser: :string],
            mood: [long: "--mood", help: "Mood (good/ok/bad)", parser: :string],
            energy: [long: "--energy", help: "Energy level", parser: :string],
            one_thing: [long: "--one-thing", help: "One thing for the day", parser: :string]
          ]
        ],
        search: [
          name: "search",
          about: "Search journal entries",
          args: [query: [required: true, help: "Search query"]]
        ],
        list: [name: "list", about: "List recent entries"]
      ]
    ]
  end

  defp resp_spec do
    [
      name: "resp",
      about: "Responsibility tracking",
      subcommands: [
        list: [
          name: "list",
          about: "List responsibilities",
          options: [
            project: [short: "-p", long: "--project", help: "Filter by project", parser: :string],
            role: [long: "--role", help: "Filter by role", parser: :string]
          ]
        ],
        show: [
          name: "show",
          about: "Show responsibility detail",
          args: [id: [required: true, help: "Responsibility ID"]]
        ],
        create: [
          name: "create",
          about: "Create responsibility",
          args: [title: [required: true, help: "Responsibility title"]],
          options: [
            role: [long: "--role", help: "Role", parser: :string],
            cadence: [long: "--cadence", help: "Cadence (daily/weekly/monthly)", parser: :string],
            description: [short: "-d", long: "--description", help: "Description", parser: :string],
            project: [short: "-p", long: "--project", help: "Project ID", parser: :string]
          ]
        ],
        check_in: [
          name: "check-in",
          about: "Check in on a responsibility",
          args: [id: [required: true, help: "Responsibility ID"]],
          options: [
            notes: [short: "-n", long: "--notes", help: "Check-in notes", parser: :string],
            status: [short: "-s", long: "--status", help: "Status (ok/at_risk/failing)", parser: :string]
          ]
        ],
        at_risk: [name: "at-risk", about: "List at-risk responsibilities"]
      ]
    ]
  end

  defp seed_spec do
    [
      name: "seed",
      about: "Proposal seed management",
      subcommands: [
        list: [
          name: "list",
          about: "List seeds",
          options: [
            project: [short: "-p", long: "--project", help: "Filter by project", parser: :string],
            active: [long: "--active", help: "Filter active only", parser: :string],
            type: [short: "-t", long: "--type", help: "Filter by seed type", parser: :string]
          ]
        ],
        show: [
          name: "show",
          about: "Show seed detail",
          args: [id: [required: true, help: "Seed ID"]]
        ],
        create: [
          name: "create",
          about: "Create seed",
          args: [title: [required: true, help: "Seed title"]],
          options: [
            prompt: [long: "--prompt", help: "Seed prompt", parser: :string],
            type: [short: "-t", long: "--type", help: "Seed type", parser: :string],
            project: [short: "-p", long: "--project", help: "Project ID", parser: :string]
          ]
        ],
        toggle: [
          name: "toggle",
          about: "Toggle seed active/paused",
          args: [id: [required: true, help: "Seed ID"]]
        ],
        run_now: [
          name: "run-now",
          about: "Trigger seed immediately",
          args: [id: [required: true, help: "Seed ID"]]
        ]
      ]
    ]
  end

  defp engine_spec do
    [
      name: "engine",
      about: "Proposal engine control",
      subcommands: [
        status: [name: "status", about: "Show engine pipeline status"],
        pause: [name: "pause", about: "Pause the engine"],
        resume: [name: "resume", about: "Resume the engine"]
      ]
    ]
  end

  defp pipe_spec do
    [
      name: "pipe",
      about: "Pipe automation",
      subcommands: [
        list: [
          name: "list",
          about: "List pipes",
          options: [
            project: [short: "-p", long: "--project", help: "Filter by project", parser: :string]
          ]
        ],
        show: [
          name: "show",
          about: "Show pipe detail",
          args: [id: [required: true, help: "Pipe ID"]]
        ],
        create: [
          name: "create",
          about: "Create pipe",
          args: [name: [required: true, help: "Pipe name"]],
          options: [
            trigger: [long: "--trigger", help: "Trigger pattern", parser: :string],
            description: [short: "-d", long: "--description", help: "Description", parser: :string]
          ]
        ],
        toggle: [
          name: "toggle",
          about: "Toggle pipe active/paused",
          args: [id: [required: true, help: "Pipe ID"]]
        ],
        fork: [
          name: "fork",
          about: "Fork (clone) a pipe",
          args: [id: [required: true, help: "Pipe ID"]]
        ],
        catalog: [name: "catalog", about: "List system/stock pipes"],
        history: [
          name: "history",
          about: "Pipe execution history",
          options: [
            limit: [short: "-l", long: "--limit", help: "Max results", parser: :integer]
          ]
        ]
      ]
    ]
  end

  defp campaign_spec do
    [
      name: "campaign",
      about: "Campaign management",
      subcommands: [
        list: [
          name: "list",
          about: "List campaigns",
          options: [
            project: [short: "-p", long: "--project", help: "Filter by project ID", parser: :string]
          ]
        ],
        show: [
          name: "show",
          about: "Show campaign detail",
          args: [id: [required: true, help: "Campaign ID"]]
        ],
        create: [
          name: "create",
          about: "Create campaign",
          args: [name: [required: true, help: "Campaign name"]],
          options: [
            description: [short: "-d", long: "--description", help: "Description", parser: :string],
            project: [short: "-p", long: "--project", help: "Project ID", parser: :string]
          ]
        ],
        run: [
          name: "run",
          about: "Start a campaign run",
          args: [id: [required: true, help: "Campaign ID"]],
          options: [
            name: [short: "-n", long: "--name", help: "Run name", parser: :string]
          ]
        ],
        runs: [
          name: "runs",
          about: "List runs for a campaign",
          args: [id: [required: true, help: "Campaign ID"]]
        ],
        advance: [
          name: "advance",
          about: "Advance campaign to next stage",
          args: [id: [required: true, help: "Campaign ID"]]
        ]
      ]
    ]
  end

  defp evolution_spec do
    [
      name: "evolution",
      about: "Evolution rules and signals",
      subcommands: [
        rules: [
          name: "rules",
          about: "List evolution rules",
          options: [
            status: [short: "-s", long: "--status", help: "Filter by status", parser: :string],
            source: [long: "--source", help: "Filter by source", parser: :string]
          ]
        ],
        show: [
          name: "show",
          about: "Show rule detail",
          args: [id: [required: true, help: "Rule ID"]]
        ],
        activate: [
          name: "activate",
          about: "Activate a rule",
          args: [id: [required: true, help: "Rule ID"]]
        ],
        rollback: [
          name: "rollback",
          about: "Roll back a rule",
          args: [id: [required: true, help: "Rule ID"]]
        ],
        signals: [name: "signals", about: "Show recent signals"],
        stats: [name: "stats", about: "Evolution statistics"],
        scan: [name: "scan", about: "Trigger signal scan now"],
        propose: [
          name: "propose",
          about: "Propose a manual evolution",
          args: [description: [required: true, help: "Description"]]
        ]
      ]
    ]
  end

  defp channel_spec do
    [
      name: "channel",
      about: "Unified channels and inbox",
      subcommands: [
        list: [name: "list", about: "List channels/servers"],
        health: [name: "health", about: "Channel health status"],
        inbox: [name: "inbox", about: "Recent messages across channels"],
        send: [
          name: "send",
          about: "Send message to channel",
          args: [
            channel: [required: true, help: "Channel ID (slug:channel_name)"],
            message: [required: true, help: "Message content"]
          ]
        ]
      ]
    ]
  end

  defp project_spec do
    [
      name: "project",
      about: "Project management",
      subcommands: [
        list: [
          name: "list",
          about: "List all projects",
          options: [
            status: [short: "-s", long: "--status", help: "Filter by status", parser: :string],
            space: [long: "--space", help: "Filter by space ID", parser: :string]
          ]
        ],
        show: [
          name: "show",
          about: "Show project detail",
          args: [slug: [required: true, help: "Project slug"]]
        ],
        create: [
          name: "create",
          about: "Create project",
          args: [name: [required: true, help: "Project name"]],
          options: [
            slug: [long: "--slug", help: "URL slug", parser: :string],
            path: [long: "--path", help: "Local path", parser: :string],
            repo: [long: "--repo", help: "Repo URL", parser: :string],
            space: [long: "--space", help: "Space ID", parser: :string],
            description: [short: "-d", long: "--description", help: "Description", parser: :string]
          ]
        ],
        context: [
          name: "context",
          about: "Show project context bundle",
          args: [slug: [required: true, help: "Project slug"]]
        ],
        dependencies: [
          name: "dependencies",
          about: "Show project task dependencies",
          args: [slug: [required: true, help: "Project slug"]]
        ]
      ]
    ]
  end

  defp babysitter_spec do
    [
      name: "babysitter",
      about: "System observability",
      subcommands: [
        state: [name: "state", about: "Show babysitter state"],
        config: [name: "config", about: "Show babysitter config"],
        nudge: [
          name: "nudge",
          about: "Send nudge message",
          args: [message: [required: true, help: "Nudge message"]]
        ],
        tick: [name: "tick", about: "Trigger immediate tick"]
      ]
    ]
  end

  defp session_spec do
    [
      name: "session",
      about: "Claude session management and orchestration",
      subcommands: [
        list: [
          name: "list",
          about: "List sessions",
          options: [
            project: [short: "-p", long: "--project", help: "Filter by project", parser: :string],
            status: [short: "-s", long: "--status", help: "Filter by status", parser: :string],
            limit: [short: "-l", long: "--limit", help: "Max results", parser: :integer]
          ]
        ],
        active: [name: "active", about: "List active sessions"],
        all: [name: "all", about: "List all sessions (CLI + detected, unified view)"],
        show: [
          name: "show",
          about: "Show session detail",
          args: [id: [required: true, help: "Session ID"]]
        ],
        spawn: [
          name: "spawn",
          about: "Spawn a new Claude Code session with EMA context",
          args: [prompt: [required: true, help: "Task prompt for the session"]],
          options: [
            project: [short: "-p", long: "--project", help: "EMA project slug", parser: :string],
            task: [short: "-t", long: "--task", help: "Link to task ID", parser: :string],
            model: [short: "-m", long: "--model", help: "Model (sonnet/opus/haiku)", parser: :string]
          ]
        ],
        follow: [
          name: "follow",
          about: "Check status and output of a session",
          args: [id: [required: true, help: "Session ID"]]
        ],
        context: [
          name: "context",
          about: "Show EMA context bundle for session injection",
          options: [
            project: [short: "-p", long: "--project", help: "Project slug", parser: :string]
          ]
        ],
        resume: [
          name: "resume",
          about: "Resume a session with follow-up prompt",
          args: [id: [required: true, help: "Session ID"]],
          options: [
            prompt: [long: "--prompt", help: "Resume prompt", parser: :string]
          ]
        ],
        kill: [
          name: "kill",
          about: "Kill a running session",
          args: [id: [required: true, help: "Session ID"]]
        ]
      ]
    ]
  end

  defp dump_spec do
    [
      name: "dump",
      about: "Quick brain dump",
      args: [thought: [required: true, help: "Thought to capture"]],
      options: [
        actor: [short: "-a", long: "--actor", help: "Actor ID", parser: :string],
        space: [long: "--space", help: "Space ID", parser: :string],
        project: [short: "-p", long: "--project", help: "Project ID", parser: :string],
        task: [short: "-t", long: "--task", help: "Task ID", parser: :string]
      ]
    ]
  end

  defp status_spec do
    [
      name: "status",
      about: "System status overview"
    ]
  end

  # -- Generated stub specs for linter-added command groups --

  defp superman_spec, do: [name: "superman", about: "Intelligence layer", subcommands: [
    ask: [name: "ask", about: "Ask a question", args: [question: [required: true, help: "Question"]]],
    health: [name: "health", about: "Index health"],
    gaps: [name: "gaps", about: "Knowledge gaps"],
    flows: [name: "flows", about: "Flow analysis"],
    index: [name: "index", about: "Trigger reindexing"]
  ]]

  defp metamind_spec, do: [name: "metamind", about: "Meta-intelligence", subcommands: [
    status: [name: "status", about: "Pipeline status"],
    library: [name: "library", about: "Prompt library"]
  ]]

  defp ralph_spec, do: [name: "ralph", about: "Feedback loop", subcommands: [
    status: [name: "status", about: "Ralph status"],
    run: [name: "run", about: "Run cycle"]
  ]]

  defp vectors_spec, do: [name: "vectors", about: "Vector search", subcommands: [
    status: [name: "status", about: "Index status"],
    query: [name: "query", about: "Query vectors", args: [query: [required: true, help: "Query"]]]
  ]]

  defp quality_spec, do: [name: "quality", about: "Quality metrics", subcommands: [
    report: [name: "report", about: "Quality report"],
    friction: [name: "friction", about: "Friction points"],
    budget: [name: "budget", about: "Quality budget"]
  ]]

  defp dispatch_board_spec, do: [name: "dispatch-board", about: "Dispatch overview", subcommands: [
    list: [name: "list", about: "In-flight executions"],
    stats: [name: "stats", about: "Dispatch stats"]
  ]]

  defp tokens_spec, do: [name: "tokens", about: "Token usage", subcommands: [
    summary: [name: "summary", about: "Usage summary"],
    budget: [name: "budget", about: "Budget status"],
    history: [name: "history", about: "Usage history"]
  ]]

  defp config_spec, do: [name: "config", about: "Configuration", subcommands: [
    view: [name: "view", about: "Show app settings"],
    list: [name: "list", about: "List container config", args: [entity: [required: true, help: "Container ref like project:ema"]]],
    get: [name: "get", about: "Get container config value",
      args: [entity: [required: true, help: "Container ref like project:ema"], key: [required: true, help: "Config key"]]],
    set: [name: "set", about: "Set container config value",
      args: [entity: [required: true, help: "Container ref like project:ema"], key: [required: true, help: "Config key"], value: [required: true, help: "JSON or string value"]]]
  ]]

  defp em_spec, do: [name: "em", about: "Executive management actor views", subcommands: [
    status: [name: "status", about: "Show actor EM status",
      args: [actor: [required: false, help: "Optional actor ID or slug"]],
      options: [
        space: [long: "--space", help: "Filter by space ID", parser: :string],
        type: [long: "--type", help: "Filter by actor type", parser: :string]
      ]],
    phases: [name: "phases", about: "Show phase transitions", args: [actor: [required: true, help: "Actor ID or slug"]]],
    velocity: [name: "velocity", about: "Show actor velocity summary", args: [actor: [required: true, help: "Actor ID or slug"]]]
  ]]

  defp tag_spec, do: [name: "tag", about: "Universal entity tagging", subcommands: [
    list: [name: "list", about: "List tags on an entity", args: [entity: [required: true, help: "Entity ref like task:123"]]],
    add: [name: "add", about: "Add a tag", args: [entity: [required: true, help: "Entity ref like task:123"], tag: [required: true, help: "Tag"]],
      options: [
        actor: [long: "--actor", help: "Actor ID", parser: :string],
        namespace: [long: "--namespace", help: "Namespace", parser: :string]
      ]],
    remove: [name: "remove", about: "Remove a tag", args: [entity: [required: true, help: "Entity ref like task:123"], tag: [required: true, help: "Tag"]],
      options: [actor: [long: "--actor", help: "Actor ID", parser: :string]]]
  ]]

  defp data_spec, do: [name: "data", about: "Per-actor entity data", subcommands: [
    list: [name: "list", about: "List entity data", args: [entity: [required: true, help: "Entity ref like task:123"]],
      options: [actor: [long: "--actor", help: "Actor ID", parser: :string]]],
    get: [name: "get", about: "Get one entity data value",
      args: [entity: [required: true, help: "Entity ref like task:123"], key: [required: true, help: "Key"]],
      options: [actor: [long: "--actor", help: "Actor ID", parser: :string]]],
    set: [name: "set", about: "Set entity data value",
      args: [entity: [required: true, help: "Entity ref like task:123"], key: [required: true, help: "Key"], value: [required: true, help: "JSON or string value"]],
      options: [actor: [long: "--actor", help: "Actor ID", parser: :string]]],
    delete: [name: "delete", about: "Delete entity data value",
      args: [entity: [required: true, help: "Entity ref like task:123"], key: [required: true, help: "Key"]],
      options: [actor: [long: "--actor", help: "Actor ID", parser: :string]]]
  ]]

  defp canvas_spec, do: [name: "canvas", about: "Visual workspaces", subcommands: [
    list: [name: "list", about: "List canvases"],
    show: [name: "show", about: "Show canvas", args: [id: [required: true, help: "Canvas ID"]]]
  ]]

  defp note_spec, do: [name: "note", about: "Simple notes", subcommands: [
    list: [name: "list", about: "List notes"],
    show: [name: "show", about: "Show note", args: [id: [required: true, help: "Note ID"]]],
    create: [name: "create", about: "Create note", args: [title: [required: true, help: "Title"]]],
    delete: [name: "delete", about: "Delete note", args: [id: [required: true, help: "Note ID"]]]
  ]]

  defp voice_spec, do: [name: "voice", about: "Voice sessions", subcommands: [
    list: [name: "list", about: "List sessions"],
    process: [name: "process", about: "Process text", args: [text: [required: true, help: "Text input"]]]
  ]]

  defp org_spec, do: [name: "org", about: "Organizations", subcommands: [
    list: [name: "list", about: "List orgs"],
    show: [name: "show", about: "Show org", args: [id: [required: true, help: "Org ID"]]],
    create: [name: "create", about: "Create org", args: [name: [required: true, help: "Name"]]],
    members: [name: "members", about: "List members", args: [id: [required: true, help: "Org ID"]]],
    invite: [name: "invite", about: "Create invitation", args: [id: [required: true, help: "Org ID"]]]
  ]]

  defp integration_spec, do: [name: "integration", about: "Integrations", subcommands: [
    list: [name: "list", about: "List integrations"],
    status: [name: "status", about: "Integration status"]
  ]]

  defp reflexion_spec, do: [name: "reflexion", about: "Memory entries", subcommands: [
    list: [name: "list", about: "List entries"],
    create: [name: "create", about: "Create entry", args: [content: [required: true, help: "Content"]]]
  ]]

  defp ai_session_spec, do: [name: "ai-session", about: "AI sessions", subcommands: [
    list: [name: "list", about: "List sessions"],
    show: [name: "show", about: "Show session", args: [id: [required: true, help: "Session ID"]]],
    create: [name: "create", about: "Create session"],
    resume: [name: "resume", about: "Resume session", args: [id: [required: true, help: "Session ID"]]],
    fork: [name: "fork", about: "Fork session", args: [id: [required: true, help: "Session ID"]]]
  ]]

  defp routing_spec, do: [name: "routing", about: "AI routing", subcommands: [
    stats: [name: "stats", about: "Routing stats"],
    fitness: [name: "fitness", about: "Provider fitness"]
  ]]

  defp git_sync_spec, do: [name: "git-sync", about: "Git intelligence", subcommands: [
    status: [name: "status", about: "Sync status"],
    scan: [name: "scan", about: "Trigger scan"]
  ]]

  defp tunnel_spec, do: [name: "tunnel", about: "SSH tunnels", subcommands: [
    list: [name: "list", about: "List tunnels"],
    create: [name: "create", about: "Create tunnel"],
    delete: [name: "delete", about: "Delete tunnel", args: [pid: [required: true, help: "Tunnel PID"]]]
  ]]

  defp file_vault_spec, do: [name: "file-vault", about: "File vault", subcommands: [
    list: [name: "list", about: "List files"],
    upload: [name: "upload", about: "Upload file"]
  ]]

  defp messages_spec, do: [name: "messages", about: "Message hub", subcommands: [
    list: [name: "list", about: "List messages"],
    conversations: [name: "conversations", about: "List conversations"],
    send: [name: "send", about: "Send message", args: [content: [required: true, help: "Message"]]]
  ]]

  defp team_pulse_spec, do: [name: "team-pulse", about: "Team analytics", subcommands: [
    overview: [name: "overview", about: "Team overview"],
    agents: [name: "agents", about: "Agent performance"],
    velocity: [name: "velocity", about: "Team velocity"]
  ]]

  defp metrics_spec, do: [name: "metrics", about: "System metrics", subcommands: [
    summary: [name: "summary", about: "Metrics summary"],
    by_domain: [name: "by-domain", about: "Metrics by domain"]
  ]]

  defp feedback_spec, do: [name: "feedback", about: "Feedback stream", subcommands: [
    list: [name: "list", about: "List feedback"],
    emit: [name: "emit", about: "Emit feedback", args: [message: [required: true, help: "Feedback"]]]
  ]]

  defp dashboard_spec, do: [name: "dashboard", about: "Dashboard data", subcommands: [
    today: [name: "today", about: "Today's dashboard"]
  ]]

  defp watch_spec do
    [
      name: "watch",
      about: "Live event stream (Ctrl+C to exit)",
      options: [
        channel: [
          short: "-c",
          long: "--channel",
          help: "Channel: all, babysitter, proposals, executions, focus, tasks, agents, pipeline, inbox",
          parser: :string
        ],
        format: [
          short: "-f",
          long: "--format",
          help: "Output format: compact or pretty",
          parser: :string
        ]
      ]
    ]
  end

  defp actor_spec, do: [name: "actor", about: "Actor management", subcommands: [
    list: [name: "list", about: "List actors", options: [
      space: [long: "--space", help: "Space ID", parser: :string],
      type: [long: "--type", help: "Actor type", parser: :string],
      status: [long: "--status", help: "Status", parser: :string]
    ]],
    show: [name: "show", about: "Show actor", args: [id: [required: true, help: "Actor ID or slug"]]],
    create: [name: "create", about: "Create actor", args: [name: [required: true, help: "Actor name"]],
      options: [
        type: [long: "--type", help: "Actor type (human/agent)", parser: :string],
        space: [long: "--space", help: "Space ID", parser: :string],
        capabilities: [long: "--capabilities", help: "JSON array or object", parser: :string]
      ]],
    transition: [name: "transition", about: "Transition phase",
      args: [id: [required: true, help: "Actor ID"], phase: [required: true, help: "Target phase (idle/plan/execute/review/retro)"]],
      options: [reason: [long: "--reason", help: "Reason for transition", parser: :string]]],
    commands: [name: "commands", about: "List actor commands", args: [id: [required: true, help: "Actor ID"]]],
    phases: [name: "phases", about: "List actor phase transitions", args: [id: [required: true, help: "Actor ID or slug"]]],
    register: [name: "register", about: "Register actor command",
      args: [
        id: [required: true, help: "Actor ID"],
        command: [required: true, help: "Command string"],
        handler: [required: true, help: "Handler as Module.function or Module:function"]
      ],
      options: [
        description: [long: "--description", help: "Description", parser: :string],
        args_spec: [long: "--args-spec", help: "Optional JSON args spec", parser: :string]
      ]]
  ]]

  defp space_spec, do: [name: "space", about: "Space management", subcommands: [
    list: [name: "list", about: "List spaces"],
    show: [name: "show", about: "Show space", args: [id: [required: true, help: "Space ID"]]],
    create: [name: "create", about: "Create space", args: [name: [required: true, help: "Space name"]],
      options: [
        org: [long: "--org", help: "Organization ID", parser: :string],
        type: [long: "--type", help: "Space type (personal/team/project)", parser: :string],
        portable: [long: "--portable", help: "Portable personal space (true/false)", parser: :string]
      ]]
  ]]

  defp intent_spec, do: [name: "intent", about: "Intent map", subcommands: [
    list: [name: "list", about: "List intent nodes",
      options: [project: [short: "-p", long: "--project", help: "Filter by project", parser: :string]]],
    show: [name: "show", about: "Show intent node", args: [id: [required: true, help: "Node ID"]]],
    tree: [name: "tree", about: "Show intent tree",
      options: [project: [short: "-p", long: "--project", help: "Project ID", parser: :string]]],
    export: [name: "export", about: "Export intents as markdown",
      options: [project: [short: "-p", long: "--project", help: "Project ID", parser: :string]]]
  ]]

  defp gap_spec, do: [name: "gap", about: "Gap/friction tracking", subcommands: [
    list: [name: "list", about: "List gaps"],
    resolve: [name: "resolve", about: "Resolve gap", args: [id: [required: true, help: "Gap ID"]]],
    "create-task": [name: "create-task", about: "Create task from gap", args: [id: [required: true, help: "Gap ID"]]],
    scan: [name: "scan", about: "Trigger gap scan"]
  ]]

  defp maybe_dispatch_actor_command([root | _rest]) when root in @builtin_roots, do: :continue
  defp maybe_dispatch_actor_command([]), do: :continue

  defp maybe_dispatch_actor_command([first | _] = args) do
    if actor_command_root?(first) do
      {parsed_opts, rest, invalid} =
        OptionParser.parse(
          args,
          strict: @actor_dispatch_switches,
          aliases: @actor_dispatch_aliases
        )

      case {invalid, rest} do
        {[], [actor_ref | words]} when words != [] ->
          dispatch_actor_command(actor_ref, words, parsed_opts)

        {[], [_actor_ref]} ->
          Output.error("Missing actor command")
          {:halt, 1}

        {[_ | _], _} ->
          Enum.each(invalid, fn {flag, _} -> Output.error("Unknown option: #{flag}") end)
          {:halt, 1}
      end
    else
      :continue
    end
  end

  defp dispatch_actor_command(actor_ref, words, parsed_opts) do
    transport = Transport.resolve(host: parsed_opts[:host])
    opts = parsed_opts |> Enum.into(%{}) |> Map.put(:json, parsed_opts[:json] || false)

    case transport do
      Ema.CLI.Transport.Direct ->
        with {:ok, actor} <- lookup_actor(actor_ref, transport),
             {:ok, command, remaining_args} <- lookup_registered_command(actor, words, transport),
             {:ok, result} <- execute_registered_command(actor, command, remaining_args, transport, opts) do
          emit_actor_command_result(result, opts)
          {:halt, 0}
        else
          {:error, reason} ->
            Output.error(reason)
            {:halt, 1}
        end

      Ema.CLI.Transport.Http ->
        Output.error("Actor commands require a direct runtime; HTTP dispatch is not implemented")
        {:halt, 1}
    end
  end

  defp lookup_actor(actor_ref, transport) do
    case transport.call(Ema.Actors, :get_actor, [actor_ref]) do
      {:ok, nil} ->
        case transport.call(Ema.Actors, :get_actor_by_slug, [actor_ref]) do
          {:ok, nil} -> {:error, "Actor #{actor_ref} not found"}
          {:ok, actor} -> {:ok, actor}
          {:error, reason} -> {:error, inspect(reason)}
        end

      {:ok, actor} ->
        {:ok, actor}

      {:error, reason} ->
        {:error, inspect(reason)}
    end
  end

  defp lookup_registered_command(actor, words, transport) do
    phrase = Enum.join(words, " ")

    case transport.call(Ema.Actors, :list_commands, [actor.id]) do
      {:ok, commands} ->
        commands
        |> Enum.filter(fn command ->
          phrase == command.command_name or String.starts_with?(phrase, command.command_name <> " ")
        end)
        |> Enum.max_by(&String.length(&1.command_name), fn -> nil end)
        |> case do
          nil ->
            {:error, "No registered command matched #{inspect(phrase)} for #{actor.slug || actor.id}"}

          command ->
            remaining_args =
              phrase
              |> String.trim_leading(command.command_name)
              |> String.trim()
              |> case do
                "" -> []
                rest -> String.split(rest, " ", trim: true)
              end

            {:ok, command, remaining_args}
        end

      {:error, reason} ->
        {:error, inspect(reason)}
    end
  end

  defp execute_registered_command(actor, command, remaining_args, transport, opts) do
    with {:ok, module, function} <- parse_registered_handler(command) do
      Code.ensure_loaded(module)

      result =
        cond do
          function_exported?(module, function, 4) ->
            apply(module, function, [actor, remaining_args, transport, opts])

          function_exported?(module, function, 3) ->
            apply(module, function, [actor, remaining_args, opts])

          function_exported?(module, function, 2) ->
            apply(module, function, [actor, remaining_args])

          function_exported?(module, function, 1) ->
            apply(module, function, [actor])

          true ->
            {:error, "Handler #{inspect(module)}.#{function} is not exported with a supported arity"}
        end

      case result do
        {:ok, _} = ok -> ok
        {:error, reason} -> {:error, inspect(reason)}
        other -> {:ok, other}
      end
    end
  end

  defp parse_registered_handler(command) do
    cond do
      not blank?(Map.get(command, :handler) || Map.get(command, "handler")) ->
        parse_handler_string(command.command_name, Map.get(command, :handler) || Map.get(command, "handler"))

      blank?(command.handler_module) and blank?(command.handler_function) ->
        {:error, "Registered command #{command.command_name} is missing its handler"}

      not blank?(command.handler_module) and not blank?(command.handler_function) ->
        {:ok, parse_module(command.handler_module), String.to_atom(command.handler_function)}

      true ->
        {:error, "Registered command #{command.command_name} has an incomplete handler"}
    end
  rescue
    error ->
      {:error, Exception.message(error)}
  end

  defp parse_handler_string(command_name, handler) do
    case Regex.run(~r/^(.*)[:.]([^.:\s]+)$/, handler, capture: :all_but_first) do
      [module_name, function_name] when module_name != "" ->
        {:ok, parse_module(module_name), String.to_atom(function_name)}

      _ ->
        {:error, "Registered command #{command_name} has an invalid handler #{inspect(handler)}"}
    end
  end

  defp emit_actor_command_result(:ok, _opts), do: :ok
  defp emit_actor_command_result({:ok, value}, opts), do: emit_actor_command_result(value, opts)

  defp emit_actor_command_result(value, opts) do
    cond do
      opts[:json] ->
        Ema.CLI.Output.json(value)

      is_binary(value) ->
        IO.puts(value)

      is_map(value) or is_list(value) ->
        Ema.CLI.Output.detail(value)

      true ->
        IO.puts(inspect(value))
    end
  end

  defp columns do
    case :io.columns() do
      {:ok, cols} -> cols
      _ -> 80
    end
  end

  defp put_lines(lines) when is_list(lines), do: Enum.each(lines, &IO.puts/1)
  defp put_lines(line), do: IO.puts(line)
  defp actor_command_root?(value) when is_binary(value), do: String.trim(value) != "" and value not in @builtin_roots
  defp parse_module(module_name), do: module_name |> String.split(".", trim: true) |> drop_elixir_prefix() |> Module.concat()
  defp drop_elixir_prefix(["Elixir" | rest]), do: rest
  defp drop_elixir_prefix(rest), do: rest
  defp blank?(value), do: value in [nil, ""]

end
