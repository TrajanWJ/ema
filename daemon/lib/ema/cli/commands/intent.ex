defmodule Ema.CLI.Commands.Intent do
  @moduledoc "CLI commands for intent engine management."

  alias Ema.CLI.Output

  @columns [
    {"ID", :id},
    {"Title", :title},
    {"Level", :level_name},
    {"Kind", :kind},
    {"Status", :status},
    {"Project", :project_id}
  ]

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter_opts =
          []
          |> maybe_add(:project_id, parsed.options[:project])
          |> maybe_add(:level, parsed.options[:level])
          |> maybe_add(:status, parsed.options[:status])
          |> maybe_add(:kind, parsed.options[:kind])
          |> maybe_add(:limit, parsed.options[:limit])

        case transport.call(Ema.Intents, :list_intents, [filter_opts]) do
          {:ok, intents} ->
            Output.render(Enum.map(intents, &Ema.Intents.serialize/1), @columns,
              json: opts[:json]
            )

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params =
          []
          |> maybe_param("project_id", parsed.options[:project])
          |> maybe_param("level", parsed.options[:level])
          |> maybe_param("status", parsed.options[:status])
          |> maybe_param("kind", parsed.options[:kind])
          |> maybe_param("limit", parsed.options[:limit])

        case transport.get("/intents", params: params) do
          {:ok, body} -> Output.render(body["intents"] || [], @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :get_intent_detail, [id]) do
          {:ok, nil} -> Output.error("Intent #{id} not found")
          {:ok, intent} -> Output.detail(intent, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/intents/#{id}") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, :not_found} -> Output.error("Intent #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:tree], parsed, transport, opts) do
    project = parsed.args[:project] || parsed.options[:project]

    case transport do
      Ema.CLI.Transport.Direct ->
        tree_opts = if project, do: [project_id: project], else: []

        case transport.call(Ema.Intents, :tree, [tree_opts]) do
          {:ok, tree} ->
            tree = Enum.map(tree, &Ema.Intents.serialize_tree/1)
            if opts[:json], do: Output.json(tree), else: render_tree(tree)

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        path =
          if project,
            do: "/intents/tree?project_id=#{project}",
            else: "/intents/tree"

        case transport.get(path) do
          {:ok, body} ->
            if opts[:json], do: Output.json(body), else: render_tree(body["tree"] || [])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:export], parsed, transport, opts) do
    project = parsed.args[:project] || parsed.options[:project]

    case transport do
      Ema.CLI.Transport.Direct ->
        export_opts = if project, do: [project_id: project], else: []

        case transport.call(Ema.Intents, :export_markdown, [export_opts]) do
          {:ok, md} -> if opts[:json], do: Output.json(%{markdown: md}), else: IO.puts(md)
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        # Export uses tree endpoint data; not a dedicated route yet
        path =
          if project,
            do: "/intents/tree?project_id=#{project}",
            else: "/intents/tree"

        case transport.get(path) do
          {:ok, body} ->
            if opts[:json], do: Output.json(body), else: IO.puts(inspect(body, pretty: true))

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    level = resolve_level(parsed.options[:level])

    attrs =
      %{
        title: parsed.args.title,
        level: level,
        kind: parsed.options[:kind] || "task",
        project_id: parsed.options[:project],
        description: parsed.options[:description]
      }
      |> maybe_put(:status, parsed.options[:status])
      |> maybe_put(:parent_id, parsed.options[:parent])

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :create_intent, [attrs]) do
          {:ok, intent} -> Output.detail(Ema.Intents.serialize(intent), json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/intents", attrs) do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:status], parsed, transport, opts) do
    project = parsed.options[:project]

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :status_summary, [[project_id: project]]) do
          {:ok, summary} -> Output.detail(summary, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = if project, do: [project_id: project], else: []

        case transport.get("/intents/status", params: params) do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:context], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        detail = transport.call(Ema.Intents, :get_intent_detail, [id])
        print_context_result(detail, id, opts)

      Ema.CLI.Transport.Http ->
        case transport.get("/intents/#{id}") do
          {:ok, body} -> print_context(body["intent"] || body, opts)
          {:error, :not_found} -> Output.error("Intent #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:link], parsed, transport, opts) do
    id = parsed.args.id
    parent = parsed.options[:parent]
    target = parsed.options[:depends_on]
    role = parsed.options[:role] || "related"

    cond do
      parent && parent != "" ->
        do_set_parent(id, parent, transport, opts)

      target && target != "" ->
        do_create_edge(id, target, role, transport, opts)

      true ->
        Output.error("Missing --parent or --depends-on option")
    end
  end

  def handle([:unlink], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :clear_parent, [id]) do
          {:ok, intent} ->
            Output.success("Cleared parent on " <> id)
            Output.detail(Ema.Intents.serialize(intent), json: opts[:json])

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/intents/" <> id <> "/parent") do
          {:ok, body} ->
            Output.success("Cleared parent on " <> id)
            Output.detail(body, json: opts[:json])

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:orphans], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :orphans, []) do
          {:ok, list} ->
            rows = Enum.map(list, &Ema.Intents.serialize/1)
            Output.render(rows, @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/intents/orphans") do
          {:ok, body} ->
            Output.render(body["orphans"] || [], @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:ancestors], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :ancestors, [id]) do
          {:ok, list} ->
            rows = Enum.map(list, &Ema.Intents.serialize/1)
            Output.render(rows, @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/intents/" <> id <> "/ancestors") do
          {:ok, body} -> Output.render(body["ancestors"] || [], @columns, json: opts[:json])
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:descendants], parsed, transport, opts) do
    id = parsed.args.id
    depth = parsed.options[:depth] || 10

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :descendants, [id, depth]) do
          {:ok, list} ->
            rows = Enum.map(list, &Ema.Intents.serialize/1)
            Output.render(rows, @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/intents/" <> id <> "/descendants?max_depth=" <> to_string(depth)) do
          {:ok, body} -> Output.render(body["descendants"] || [], @columns, json: opts[:json])
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:path], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :lineage_path, [id]) do
          {:ok, list} ->
            rows = Enum.map(list, &Ema.Intents.serialize/1)

            if opts[:json] do
              Output.json(rows)
            else
              render_path(rows, id)
            end

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/intents/" <> id <> "/path") do
          {:ok, body} ->
            if opts[:json] do
              Output.json(body)
            else
              render_path(body["path"] || [], id)
            end

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:"attach-actor"], parsed, transport, opts) do
    id = parsed.args.id
    actor_id = parsed.options[:actor]

    unless actor_id, do: Output.error("Missing --actor option")

    body = %{
      actor_id: actor_id,
      role: parsed.options[:role] || "assignee",
      provenance: parsed.options[:provenance] || "manual"
    }

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :attach_actor, [
               id,
               actor_id,
               role: body.role,
               provenance: body.provenance
             ]) do
          {:ok, link} -> Output.detail(Ema.Intents.serialize_link(link), json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/intents/#{id}/actors", body) do
          {:ok, resp} -> Output.detail(resp, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:"attach-execution"], parsed, transport, opts) do
    id = parsed.args.id
    execution_id = parsed.options[:execution]

    unless execution_id, do: Output.error("Missing --execution option")

    body = %{
      execution_id: execution_id,
      role: parsed.options[:role] || "runtime",
      provenance: parsed.options[:provenance] || "execution"
    }

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :attach_execution, [
               id,
               execution_id,
               role: body.role,
               provenance: body.provenance
             ]) do
          {:ok, link} -> Output.detail(Ema.Intents.serialize_link(link), json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/intents/#{id}/executions", body) do
          {:ok, resp} -> Output.detail(resp, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:"attach-session"], parsed, transport, opts) do
    id = parsed.args.id
    session_id = parsed.options[:session]

    unless session_id, do: Output.error("Missing --session option")

    body = %{
      session_id: session_id,
      session_type: parsed.options[:session_type] || "claude_session",
      role: parsed.options[:role] || "runtime",
      provenance: parsed.options[:provenance]
    }

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :attach_session, [
               id,
               body.session_type,
               session_id,
               role: body.role,
               provenance: body.provenance
             ]) do
          {:ok, link} -> Output.detail(Ema.Intents.serialize_link(link), json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/intents/#{id}/sessions", body) do
          {:ok, resp} -> Output.detail(resp, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:runtime], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :get_runtime_bundle, [id]) do
          {:ok, nil} -> Output.error("Intent #{id} not found")
          {:ok, bundle} -> Output.detail(bundle, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/intents/#{id}/runtime") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, :not_found} -> Output.error("Intent #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:update], parsed, transport, opts) do
    id = parsed.args.id

    level = if parsed.options[:level], do: resolve_level(parsed.options[:level]), else: nil

    attrs =
      %{}
      |> maybe_put(:title, parsed.options[:title])
      |> maybe_put(:status, parsed.options[:status])
      |> maybe_put(:level, level)
      |> maybe_put(:description, parsed.options[:description])
      |> maybe_put(:project_id, parsed.options[:project])
      |> maybe_put(:parent_id, parsed.options[:parent])

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :update_intent, [id, attrs]) do
          {:ok, intent} -> Output.detail(Ema.Intents.serialize(intent), json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.put("/intents/#{id}", attrs) do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, :not_found} -> Output.error("Intent #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :delete_intent, [id]) do
          {:ok, _} -> Output.success("Deleted intent #{id}")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/intents/#{id}") do
          {:ok, _} -> Output.success("Deleted intent #{id}")
          {:error, :not_found} -> Output.error("Intent #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:lineage], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intents, :get_intent_detail, [id]) do
          {:ok, nil} -> Output.error("Intent #{id} not found")
          {:ok, detail} -> Output.detail(detail, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/intents/#{id}/lineage") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, :not_found} -> Output.error("Intent #{id} not found")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  # ── Schematic: target (sticky scope) ─────────────────────────────

  @sticky_target_key "intent.sticky_target"

  def handle([:target], parsed, _transport, _opts) do
    action = parsed.args[:action]

    cond do
      is_nil(action) or action == "" ->
        case Ema.Settings.get(@sticky_target_key) do
          nil -> Output.info("(no sticky target set)")
          "" -> Output.info("(no sticky target set)")
          path -> Output.info("Sticky target: #{path}")
        end

      action == "list" ->
        case safe_call(fn -> Ema.Intents.Schematic.Target.list_paths() end) do
          {:ok, []} -> Output.info("(no scope paths)")
          {:ok, paths} -> Enum.each(paths, &IO.puts/1)
          {:error, reason} -> Output.error(inspect(reason))
        end

      true ->
        case Ema.Intents.Schematic.Target.resolve(action) do
          {:ok, _target} ->
            case Ema.Settings.set(@sticky_target_key, action) do
              {:ok, _} -> Output.success("Sticky target set: #{action}")
              {:error, reason} -> Output.error(inspect(reason))
            end

          {:error, reason} ->
            Output.error("Invalid scope: #{inspect(reason)}")
        end
    end
  end

  # ── Schematic: apply (NL freetext update) ────────────────────────

  def handle([:apply], parsed, _transport, opts) do
    use_current = parsed.flags[:target_current] || false
    arg1 = parsed.args[:scope_or_text]
    arg2 = parsed.args[:text]

    {scope, text} =
      cond do
        use_current ->
          {Ema.Settings.get(@sticky_target_key), arg1 || arg2}

        is_binary(arg1) and is_binary(arg2) ->
          {arg1, arg2}

        true ->
          {nil, nil}
      end

    cond do
      is_nil(scope) or scope == "" ->
        Output.error(
          "Missing scope. Provide <scope-path> <text>, or set sticky target then use --target-current."
        )

      is_nil(text) or text == "" ->
        Output.error("Missing freetext.")

      true ->
        run_engine_update(scope, text, opts)
    end
  end

  # ── Schematic: modification toggle ───────────────────────────────

  def handle([:modification], parsed, _transport, _opts) do
    action = parsed.args[:action]
    scope = parsed.args[:scope] || ""
    alias Ema.Intents.Schematic.ModificationToggle

    case action do
      "status" ->
        if scope == "" do
          states = ModificationToggle.list_states()
          global = ModificationToggle.state("")
          Output.info("Global: #{format_mod_state(global)}")
          Output.info("Explicit overrides: #{length(states)}")

          Enum.each(states, fn s ->
            Output.info("  #{s.scope_path}: enabled=#{s.enabled} reason=#{s.disabled_reason || "-"}")
          end)
        else
          state = ModificationToggle.state(scope)
          Output.info("#{scope}: #{format_mod_state(state)}")
        end

      "disable" ->
        opts =
          []
          |> maybe_add(:reason, parsed.options[:reason])
          |> maybe_add(:until, parse_until(parsed.options[:until]))

        case ModificationToggle.disable(scope, opts) do
          {:ok, row} ->
            Output.success("Disabled NL modification for '#{scope}'")
            Output.detail(row)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      "enable" ->
        case ModificationToggle.enable(scope) do
          {:ok, row} ->
            Output.success("Enabled NL modification for '#{scope}'")
            Output.detail(row)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      other ->
        Output.error("Unknown modification action: #{inspect(other)} (use status|disable|enable)")
    end
  end

  # ── Schematic: contradictions ────────────────────────────────────

  def handle([:contradictions], parsed, _transport, opts) do
    import Ecto.Query
    alias Ema.Intents.Schematic.Contradiction
    alias Ema.Repo

    case parsed.args[:action] do
      "list" ->
        q = from(c in Contradiction, where: c.status == "open", order_by: [desc: c.inserted_at])

        q =
          case parsed.options[:scope] do
            nil -> q
            s -> from c in q, where: c.scope_path == ^s
          end

        q =
          case parsed.options[:severity] do
            nil -> q
            sev -> from c in q, where: c.severity == ^sev
          end

        rows = Repo.all(q)

        cols = [
          {"ID", :id},
          {"Scope", :scope_path},
          {"Severity", :severity},
          {"Description", :description}
        ]

        Output.render(rows, cols, json: opts[:json])

      "show" ->
        require_id(parsed, fn id ->
          case Repo.get(Contradiction, id) do
            nil -> Output.error("Contradiction #{id} not found")
            row -> Output.detail(row, json: opts[:json])
          end
        end)

      "resolve" ->
        require_id(parsed, fn id ->
          notes = parsed.options[:note] || parsed.options[:notes]
          actor = parsed.options[:actor]

          case Ema.Intents.Schematic.Contradictions.resolve(id, notes, actor) do
            {:ok, c} ->
              Output.success("Resolved contradiction #{c.id}")
              Output.detail(c, json: opts[:json])

            {:error, :not_found} ->
              Output.error("Contradiction #{id} not found")

            {:error, reason} ->
              Output.error("Failed to resolve: #{inspect(reason)}")
          end
        end)

      "dismiss" ->
        require_id(parsed, fn id ->
          actor = parsed.options[:actor]

          case Ema.Intents.Schematic.Contradictions.dismiss(id, actor) do
            {:ok, c} ->
              Output.success("Dismissed contradiction #{c.id}")
              Output.detail(c, json: opts[:json])

            {:error, :not_found} ->
              Output.error("Contradiction #{id} not found")

            {:error, reason} ->
              Output.error("Failed to dismiss: #{inspect(reason)}")
          end
        end)

      other ->
        Output.error("Unknown contradictions action: #{inspect(other)}")
    end
  end

  # ── Schematic: aspirations ───────────────────────────────────────

  def handle([:aspirations], parsed, _transport, opts) do
    alias Ema.Intents.Schematic.Aspirations

    case parsed.args[:action] do
      "list" ->
        list_opts =
          []
          |> maybe_put(:scope_path, parsed.options[:scope])
          |> maybe_put(:status, parsed.options[:status])

        rows = Aspirations.list(list_opts)

        cols = [
          {"ID", :id},
          {"Title", :title},
          {"Horizon", :horizon},
          {"Status", :status},
          {"Weight", :weight},
          {"Scope", :scope_path}
        ]

        Output.render(rows, cols, json: opts[:json])

      "push" ->
        title = parsed.args[:value]

        if is_nil(title) or title == "" do
          Output.error("Missing aspiration title")
        else
          attrs = %{
            title: title,
            horizon: parsed.options[:horizon] || "long",
            scope_path: parsed.options[:scope]
          }

          case Aspirations.push(attrs) do
            {:ok, row} ->
              Output.success("Pushed aspiration #{row.id}")
              Output.detail(row, json: opts[:json])

            {:error, changeset} ->
              Output.error(inspect(changeset.errors))
          end
        end

      "promote" ->
        require_id_value(parsed, fn id ->
          case Aspirations.promote(id) do
            {:ok, %{aspiration: aspiration, intent: intent}} ->
              Output.success("Promoted aspiration #{aspiration.id} → intent #{intent.id}")
              Output.detail(intent, json: opts[:json])

            {:error, :not_found} ->
              Output.error("Aspiration #{id} not found")

            {:error, :not_stacked} ->
              Output.error("Aspiration #{id} is not stacked — cannot promote")

            {:error, %Ecto.Changeset{} = changeset} ->
              Output.error(inspect(changeset.errors))

            {:error, reason} ->
              Output.error(inspect(reason))
          end
        end)

      "retire" ->
        require_id_value(parsed, fn id ->
          case Aspirations.retire(id) do
            {:ok, aspiration} ->
              Output.success("Retired aspiration #{aspiration.id}")
              Output.detail(aspiration, json: opts[:json])

            {:error, :not_found} ->
              Output.error("Aspiration #{id} not found")

            {:error, %Ecto.Changeset{} = changeset} ->
              Output.error(inspect(changeset.errors))
          end
        end)

      other ->
        Output.error("Unknown aspirations action: #{inspect(other)}")
    end
  end

  # ── Schematic: clarifications & hard-answers (FeedItem) ──────────

  def handle([:clarifications], parsed, _transport, opts) do
    handle_feed("clarification", parsed, opts)
  end

  def handle([:"hard-answers"], parsed, _transport, opts) do
    handle_feed("hard_answer", parsed, opts)
  end

  # ── Catch-all ────────────────────────────────────────────────────

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown intent subcommand: #{inspect(sub)}")
  end

  # ── Schematic helpers (defined after all def handle clauses) ─────

  defp run_engine_update(scope, text, opts) do
    engine = Ema.Intents.Schematic.Engine

    if Code.ensure_loaded?(engine) and function_exported?(engine, :update, 3) do
      case engine.update(scope, text, []) do
        {:ok, result} ->
          if opts[:json] do
            Output.json(result)
          else
            print_engine_summary(scope, result)
          end

        {:error, reason} ->
          Output.error(inspect(reason))
      end
    else
      Output.warn("TODO: Ema.Intents.Schematic.Engine.update/3 not yet wired (Wave 1 in progress)")
      Output.info("  scope: #{scope}")
      Output.info("  text:  #{text}")
    end
  end

  defp print_engine_summary(scope, result) do
    plan = Map.get(result, :plan) || []
    affected = Map.get(result, :affected) || []
    contradictions = Map.get(result, :contradictions) || []
    clarifications = Map.get(result, :clarifications) || []
    aspirations = Map.get(result, :aspirations) || []
    log_id = Map.get(result, :log_id)

    Output.success("Applied schematic update to #{scope}")
    Output.info("  mutations:      #{length(plan)}")
    Output.info("  affected:       #{length(affected)}")
    Output.info("  contradictions: #{length(contradictions)}")
    Output.info("  clarifications: #{length(clarifications)}")
    Output.info("  aspirations:    #{length(aspirations)}")
    if log_id, do: Output.info("  log:            #{log_id}")
  end

  defp format_mod_state(%{enabled: true, explicit: true, source_scope: src}),
    do: "enabled (explicit @ #{src})"

  defp format_mod_state(%{enabled: true}), do: "enabled (default)"

  defp format_mod_state(%{enabled: false, disabled_reason: reason, source_scope: src}),
    do: "disabled @ #{src} — #{reason || "no reason"}"

  defp parse_until(nil), do: nil

  defp parse_until(str) do
    case DateTime.from_iso8601(str) do
      {:ok, dt, _} -> dt
      _ -> nil
    end
  end

  defp handle_feed(feed_type, parsed, opts) do
    mod = feed_module(feed_type)

    case parsed.args[:action] do
      "list" ->
        list_opts =
          []
          |> maybe_kw(:scope_path, parsed.options[:scope])
          |> maybe_kw(:status, parsed.options[:status] || :any)

        rows = mod.list(list_opts)

        cols = [
          {"ID", :id},
          {"Title", :title},
          {"Scope", :scope_path},
          {"Status", :status}
        ]

        Output.render(rows, cols, json: opts[:json])

      "show" ->
        require_id(parsed, fn id ->
          case mod.get(id) do
            nil ->
              Output.error("Feed item #{id} not found")

            row ->
              if row.feed_type != feed_type do
                Output.error("#{id} is not a #{feed_type}")
              else
                Output.detail(row, json: opts[:json])

                if is_map(row.options) and map_size(row.options) > 0 do
                  Output.info("\nOptions:")
                  IO.puts(inspect(row.options, pretty: true))
                end
              end
          end
        end)

      "request" ->
        scope = parsed.args[:id] || parsed.options[:scope]

        cond do
          is_nil(scope) or scope == "" ->
            Output.error(
              "Missing scope. Usage: ema intent #{feed_type_label(feed_type)} request <scope>"
            )

          true ->
            case mod.request(scope) do
              {:ok, items} ->
                Output.success(
                  "Created #{length(items)} #{feed_type_label(feed_type)} item(s) for #{scope}"
                )

                Enum.each(items, fn item ->
                  Output.info("  #{item.id}  #{item.title}")
                end)

              {:error, :claude_not_available} ->
                Output.error(
                  "Claude CLI not available — cannot generate #{feed_type_label(feed_type)} items"
                )

              {:error, reason} ->
                Output.error("Request failed: #{inspect(reason)}")
            end
        end

      "answer" ->
        require_id(parsed, fn id ->
          select_str = parsed.options[:select]
          text = parsed.options[:text]

          params =
            cond do
              is_binary(select_str) and select_str != "" ->
                %{select: parse_select(select_str)}

              is_binary(text) and text != "" ->
                %{text: text}

              true ->
                nil
            end

          if is_nil(params) do
            Output.error("Provide --select A1,B2 or --text \"...\"")
          else
            case mod.answer(id, params) do
              {:ok, item} ->
                Output.success("Answered #{id}")
                if item.resolution, do: Output.info("  resolution: #{item.resolution}")

              {:error, :not_found} ->
                Output.error("Feed item #{id} not found")

              {:error, reason} ->
                Output.error(inspect(reason))
            end
          end
        end)

      "chat" ->
        require_id(parsed, fn id ->
          case mod.escalate_to_chat(id) do
            {:ok, _item} ->
              Output.success("Escalated #{id} to chat (session creation not yet implemented)")

            {:error, :not_found} ->
              Output.error("Feed item #{id} not found")

            {:error, reason} ->
              Output.error(inspect(reason))
          end
        end)

      "delete" ->
        require_id(parsed, fn id ->
          case mod.delete(id) do
            {:ok, _} -> Output.success("Deleted #{id}")
            {:error, :not_found} -> Output.error("Feed item #{id} not found")
            {:error, reason} -> Output.error(inspect(reason))
          end
        end)

      other ->
        Output.error("Unknown #{feed_type} action: #{inspect(other)}")
    end
  end

  defp feed_module("clarification"), do: Ema.Intents.Schematic.Clarifications
  defp feed_module("hard_answer"), do: Ema.Intents.Schematic.HardAnswers

  defp feed_type_label("clarification"), do: "clarifications"
  defp feed_type_label("hard_answer"), do: "hard-answers"

  defp parse_select(str) do
    str
    |> String.split(",", trim: true)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp maybe_kw(kw, _key, nil), do: kw
  defp maybe_kw(kw, key, value), do: Keyword.put(kw, key, value)

  # ── Schematic helpers ────────────────────────────────────────────

  defp require_id(parsed, fun) do
    case parsed.args[:id] do
      nil -> Output.error("Missing ID argument")
      "" -> Output.error("Missing ID argument")
      id -> fun.(id)
    end
  end

  defp require_id_value(parsed, fun) do
    case parsed.args[:value] do
      nil -> Output.error("Missing ID argument")
      "" -> Output.error("Missing ID argument")
      id -> fun.(id)
    end
  end

  defp safe_call(fun) do
    try do
      {:ok, fun.()}
    rescue
      e -> {:error, e}
    end
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp print_context_result({:ok, nil}, id, _opts), do: Output.error("Intent #{id} not found")
  defp print_context_result({:ok, detail}, _id, opts), do: print_context(detail, opts)
  defp print_context_result({:error, reason}, _id, _opts), do: Output.error(reason)
  defp print_context_result(nil, id, _opts), do: Output.error("Intent #{id} not found")

  defp print_context_result(detail, _id, opts) when is_map(detail),
    do: print_context(detail, opts)

  defp print_context(detail, opts) do
    if opts[:json] do
      Output.json(detail)
    else
      print_context_sections(detail)
    end
  end

  defp print_context_sections(detail) do
    title = detail[:title] || detail["title"] || "(untitled)"
    status = detail[:status] || detail["status"] || "unknown"
    level = detail[:level_name] || detail["level_name"] || "?"
    kind = detail[:kind] || detail["kind"] || "?"

    Output.info("\e[1m#{title}\e[0m")
    Output.info("  Status: #{status}  Level: #{level}  Kind: #{kind}")

    desc = detail[:description] || detail["description"]
    if desc, do: Output.info("  #{desc}")

    print_links_section(detail[:links] || detail["links"] || [])
    print_lineage_section(detail[:lineage] || detail["lineage"] || [])
  end

  defp print_links_section(links) do
    Output.info("\nLinks: (#{length(links)})")

    Enum.each(links, fn link ->
      type = link[:linkable_type] || link["linkable_type"] || "?"
      role = link[:role] || link["role"] || "related"
      lid = link[:linkable_id] || link["linkable_id"] || "?"
      Output.info("  #{role} -> #{type}:#{lid}")
    end)
  end

  defp print_lineage_section(events) do
    Output.info("\nLineage: (#{length(events)})")

    Enum.take(events, -10)
    |> Enum.each(fn event ->
      type = event[:event_type] || event["event_type"] || "?"
      actor = event[:actor] || event["actor"] || "system"
      ts = event[:inserted_at] || event["inserted_at"] || ""
      Output.info("  [#{ts}] #{type} (#{actor})")
    end)
  end

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, key, val), do: Keyword.put(opts, key, val)

  defp maybe_param(params, _key, nil), do: params
  defp maybe_param(params, key, val), do: [{key, val} | params]

  defp resolve_level(nil), do: 4
  defp resolve_level(val) when is_integer(val), do: val
  defp resolve_level("vision"), do: 0
  defp resolve_level("goal"), do: 1
  defp resolve_level("project"), do: 2
  defp resolve_level("feature"), do: 3
  defp resolve_level("task"), do: 4
  defp resolve_level("execution"), do: 5

  defp resolve_level(str) when is_binary(str) do
    case Integer.parse(str) do
      {n, ""} -> n
      _ -> 4
    end
  end

  # ── Transport helpers (extracted from def handle/4 clauses) ────────

  defp do_set_parent(id, parent_id, Ema.CLI.Transport.Direct = transport, opts) do
    case transport.call(Ema.Intents, :set_parent, [id, parent_id]) do
      {:ok, intent} ->
        Output.success("Linked " <> id <> " -> parent " <> parent_id)
        Output.detail(Ema.Intents.serialize(intent), json: opts[:json])

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  defp do_set_parent(id, parent_id, Ema.CLI.Transport.Http = transport, opts) do
    case transport.put("/intents/" <> id <> "/parent", %{parent_id: parent_id}) do
      {:ok, body} ->
        Output.success("Linked " <> id <> " -> parent " <> parent_id)
        Output.detail(body, json: opts[:json])

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  defp do_create_edge(id, target, role, Ema.CLI.Transport.Direct = transport, opts) do
    case transport.call(Ema.Intents, :link_intent, [id, "intent", target, [role: role]]) do
      {:ok, link} -> Output.detail(Ema.Intents.serialize_link(link), json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  defp do_create_edge(id, target, role, Ema.CLI.Transport.Http = transport, opts) do
    body = %{linkable_type: "intent", linkable_id: target, role: role}

    case transport.post("/intents/" <> id <> "/links", body) do
      {:ok, resp} -> Output.detail(resp, json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  # ── Hierarchical tree rendering ──────────────────────────────────

  defp render_tree([]) do
    Output.info("(no intents)")
  end

  defp render_tree(nodes) when is_list(nodes) do
    Enum.each(nodes, &render_tree_node(&1, 0))
  end

  defp render_tree_node(node, depth) do
    title = node[:title] || node["title"] || "(untitled)"
    status = node[:status] || node["status"] || "planned"
    level = node[:level_name] || node["level_name"] || node[:level] || node["level"] || "?"
    id = node[:id] || node["id"] || ""
    indent = String.duplicate("  ", depth)
    icon = tree_status_icon(status)
    color = status_color(status)
    reset = IO.ANSI.reset()
    dim = IO.ANSI.faint()

    Output.info(
      "#{indent}#{color}#{icon}#{reset} #{title} #{dim}[#{level}/#{status}] #{id}#{reset}"
    )

    children = node[:children] || node["children"] || []
    Enum.each(children, &render_tree_node(&1, depth + 1))
  end

  defp tree_status_icon("complete"), do: "+"
  defp tree_status_icon("active"), do: "~"
  defp tree_status_icon("implementing"), do: "*"
  defp tree_status_icon("blocked"), do: "!"
  defp tree_status_icon("archived"), do: "x"
  defp tree_status_icon(_), do: "o"

  defp status_color("complete"), do: IO.ANSI.green()
  defp status_color("active"), do: IO.ANSI.cyan()
  defp status_color("implementing"), do: IO.ANSI.cyan()
  defp status_color("blocked"), do: IO.ANSI.red()
  defp status_color("archived"), do: IO.ANSI.faint()
  defp status_color(_), do: IO.ANSI.yellow()

  defp render_path([], id) do
    Output.error("Intent #{id} not found")
  end

  defp render_path(path, focus_id) do
    Enum.with_index(path)
    |> Enum.each(fn {node, idx} ->
      title = node[:title] || node["title"] || "(untitled)"
      status = node[:status] || node["status"] || "planned"
      level = node[:level_name] || node["level_name"] || node[:level] || node["level"] || "?"
      id = node[:id] || node["id"] || ""
      indent = String.duplicate("  ", idx)
      reset = IO.ANSI.reset()
      dim = IO.ANSI.faint()
      bold = IO.ANSI.bright()
      color = status_color(status)

      marker = if id == focus_id, do: bold <> "->" <> reset, else: "  "

      Output.info(
        "#{indent}#{marker} #{color}#{title}#{reset} #{dim}[#{level}/#{status}] #{id}#{reset}"
      )
    end)
  end
end
