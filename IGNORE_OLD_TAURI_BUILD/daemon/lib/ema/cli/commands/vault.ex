defmodule Ema.CLI.Commands.Vault do
  @moduledoc "CLI commands for the knowledge wiki (Second Brain)."

  alias Ema.CLI.{Helpers, Output}

  @search_columns [
    {"ID", :id},
    {"Path", :file_path},
    {"Title", :title},
    {"Space", :space},
    {"Updated", :updated_at}
  ]

  def handle([:search], parsed, transport, opts) do
    query = parsed.args.query
    limit = parsed.options[:limit] || 10

    case transport do
      Ema.CLI.Transport.Direct ->
        search_opts = [limit: limit]

        case transport.call(Ema.SecondBrain, :search_brain, [query | [search_opts]]) do
          {:ok, results} -> Output.render(results, @search_columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = [q: query, limit: limit]

        case transport.get("/vault/search", params: params) do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "notes"), @search_columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:tree], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.SecondBrain, :get_directory_tree, []) do
          {:ok, tree} ->
            if opts[:json] do
              Output.json(tree)
            else
              print_tree(tree, "")
            end

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/vault/tree") do
          {:ok, body} ->
            tree = body["tree"] || body

            if opts[:json] do
              Output.json(tree)
            else
              print_tree(tree, "")
            end

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:read], parsed, transport, opts) do
    path = parsed.args.path

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.SecondBrain, :get_note_by_path, [path]) do
          {:ok, nil} ->
            Output.error("Note not found: #{path}")

          {:ok, note} ->
            if opts[:json] do
              Output.json(note)
            else
              case transport.call(Ema.SecondBrain, :read_note_content, [note]) do
                {:ok, content} ->
                  Output.info("# #{note.title || path}\n")
                  IO.puts(content)

                {:error, reason} ->
                  Output.error("Failed to read content: #{inspect(reason)}")
              end
            end

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/vault/note", params: [path: path]) do
          {:ok, note} ->
            if opts[:json] do
              Output.json(note)
            else
              content = note["content"] || note["body"] || ""
              title = note["title"] || path
              Output.info("# #{title}\n")
              IO.puts(content)
            end

          {:error, :not_found} ->
            Output.error("Note not found: #{path}")

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:write], parsed, transport, opts) do
    path = parsed.args.path

    content =
      cond do
        parsed.flags[:stdin] -> IO.read(:stdio, :eof)
        parsed.options[:content] -> parsed.options[:content]
        true -> IO.read(:stdio, :eof)
      end

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs = %{file_path: path, content: content, source_type: "cli"}

        case transport.call(Ema.SecondBrain, :create_note, [attrs]) do
          {:ok, note} ->
            Output.success("Wrote #{note.file_path}")
            if opts[:json], do: Output.json(note)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"path" => path, "content" => content}

        case transport.put("/vault/note", body) do
          {:ok, _} -> Output.success("Wrote #{path}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:graph], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.SecondBrain, :get_full_graph, []) do
          {:ok, {nodes, edges}} ->
            if opts[:json] do
              Output.json(%{nodes: length(nodes), edges: length(edges)})
            else
              Output.info("Wiki Graph: #{length(nodes)} nodes, #{length(edges)} edges")
            end

          {:error, reason} ->
            Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/vault/graph") do
          {:ok, graph} ->
            if opts[:json] do
              Output.json(graph)
            else
              nodes = graph["nodes"] || []
              edges = graph["edges"] || graph["links"] || []
              Output.info("Wiki Graph: #{length(nodes)} nodes, #{length(edges)} edges")
            end

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:backlinks], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.SecondBrain, :get_backlinks, [id]) do
          {:ok, links} -> Output.render(links, @search_columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/vault/graph/neighbors/#{id}") do
          {:ok, %{"notes" => links}} ->
            Output.render(links, @search_columns, json: opts[:json])

          {:ok, links} when is_list(links) ->
            Output.render(links, @search_columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:imports], _parsed, _transport, opts) do
    vault_root = Ema.Config.vault_path()
    provenance = Path.expand("#{vault_root}/imports/_provenance.md")

    if File.exists?(provenance) do
      content = File.read!(provenance)

      if opts[:json] do
        Output.json(%{path: provenance, content: content})
      else
        IO.puts(content)
      end
    else
      Output.warn("No provenance file at #{provenance}")
    end
  end

  def handle([:stale], _parsed, _transport, opts) do
    vault_root = Ema.Config.vault_path()
    intents_dir = Path.expand("#{vault_root}/intents")

    if File.dir?(intents_dir) do
      print_stale_files(intents_dir, vault_root, opts)
    else
      Output.warn("No intents directory at #{intents_dir}")
    end
  end

  def handle([:delete], parsed, transport, _opts) do
    path = parsed.args.path

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.SecondBrain, :delete_note_by_path, [path]) do
          {:ok, _} -> Output.success("Deleted #{path}")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.delete("/vault/note?path=#{URI.encode(path)}") do
          {:ok, _} -> Output.success("Deleted #{path}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:move], parsed, transport, _opts) do
    from = parsed.args.from
    to = parsed.args.to

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.SecondBrain, :move_note, [from, to]) do
          {:ok, _} -> Output.success("Moved #{from} → #{to}")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/vault/note/move", %{"from" => from, "to" => to}) do
          {:ok, _} -> Output.success("Moved #{from} → #{to}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:orphans], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.SecondBrain, :get_orphan_notes, []) do
          {:ok, notes} -> Output.render(notes, @search_columns, json: opts[:json])
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/vault/graph/orphans") do
          {:ok, %{"notes" => notes}} ->
            Output.render(notes, @search_columns, json: opts[:json])

          {:ok, notes} when is_list(notes) ->
            Output.render(notes, @search_columns, json: opts[:json])

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle([:lint], parsed, _transport, opts) do
    alias Ema.SecondBrain.VaultLint

    lint_opts =
      []
      |> maybe_put(:min_words, parsed.options[:min_words])
      |> maybe_put(:max_age_days, parsed.options[:max_age])
      |> maybe_put(:min_shared_tags, parsed.options[:min_shared])
      |> maybe_put_checks(parsed.options[:check])

    reports = VaultLint.run_all(lint_opts)

    if opts[:json] do
      Output.json(reports)
    else
      render_lint_report(reports)
    end
  end

  def handle([:neighbors], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.SecondBrain, :get_neighbors, [id]) do
          {:ok, notes} -> Output.render(notes, @search_columns, json: opts[:json])
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/vault/graph/neighbors/#{id}") do
          {:ok, %{"notes" => notes}} ->
            Output.render(notes, @search_columns, json: opts[:json])

          {:ok, notes} when is_list(notes) ->
            Output.render(notes, @search_columns, json: opts[:json])

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown wiki subcommand: #{inspect(sub)}")
  end

  defp print_tree(tree, indent) when is_map(tree) do
    name = tree["name"] || Map.get(tree, :name, "")
    type = tree["type"] || Map.get(tree, :type, "file")
    children = tree["children"] || Map.get(tree, :children, [])

    if name != "" do
      if type == "directory" do
        IO.puts("#{indent}#{IO.ANSI.cyan()}#{name}/#{IO.ANSI.reset()}")
      else
        IO.puts("#{indent}#{name}")
      end
    end

    dirs = Enum.filter(children, fn c -> (c["type"] || Map.get(c, :type)) == "directory" end)
    files = Enum.filter(children, fn c -> (c["type"] || Map.get(c, :type)) != "directory" end)

    Enum.each(dirs, &print_tree(&1, indent <> "  "))

    if length(files) > 5 do
      Enum.each(Enum.take(files, 3), &print_tree(&1, indent <> "  "))
      IO.puts("#{indent}  ... +#{length(files) - 3} more files")
    else
      Enum.each(files, &print_tree(&1, indent <> "  "))
    end
  end

  defp print_tree(tree, indent) when is_list(tree) do
    Enum.each(tree, &print_tree(&1, indent))
  end

  defp print_tree(name, indent) when is_binary(name) do
    IO.puts("#{indent}#{name}")
  end

  defp print_tree(_, _), do: :ok

  defp print_stale_files(intents_dir, vault_root, opts) do
    files = list_files_recursive(intents_dir)

    if files == [] do
      Output.info("No intent projection files found.")
    else
      now = System.os_time(:second)
      root = Path.expand(vault_root)

      rows =
        Enum.map(files, fn path ->
          rel = Path.relative_to(path, root)
          stat = File.stat!(path, time: :posix)
          age_hours = div(now - stat.mtime, 3600)

          %{"path" => rel, "age" => format_age(age_hours), "size" => "#{stat.size}b"}
        end)
        |> Enum.sort_by(& &1["age"], :desc)

      columns = [{"Path", "path"}, {"Age", "age"}, {"Size", "size"}]

      if opts[:json] do
        Output.json(rows)
      else
        Output.render(rows, columns, json: false)
      end
    end
  end

  defp list_files_recursive(dir) do
    case File.ls(dir) do
      {:ok, entries} ->
        Enum.flat_map(entries, fn entry ->
          full = Path.join(dir, entry)
          if File.dir?(full), do: list_files_recursive(full), else: [full]
        end)

      _ ->
        []
    end
  end

  defp format_age(hours) when hours < 1, do: "<1h"
  defp format_age(hours) when hours < 24, do: "#{hours}h"
  defp format_age(hours), do: "#{div(hours, 24)}d"

  # -- Lint helpers --

  defp render_lint_report(reports) do
    severity_icon = %{error: "ERR", warning: "WRN", info: "INF"}

    summary_rows =
      Enum.map(reports, fn r ->
        %{
          "check" => Atom.to_string(r.check),
          "severity" => Map.get(severity_icon, r.severity, "?"),
          "issues" => to_string(r.count)
        }
      end)

    summary_columns = [{"Check", "check"}, {"Sev", "severity"}, {"Issues", "issues"}]
    Output.render(summary_rows, summary_columns, json: false)

    # Print details for checks with issues
    reports
    |> Enum.filter(fn r -> r.count > 0 end)
    |> Enum.each(fn r ->
      IO.puts("\n--- #{r.check} (#{r.count}) ---")

      r.issues
      |> Enum.take(25)
      |> Enum.each(fn issue ->
        IO.puts("  #{issue.note_path}: #{issue.detail}")
      end)

      if r.count > 25, do: IO.puts("  ... and #{r.count - 25} more")
    end)

    total = Enum.sum(Enum.map(reports, & &1.count))
    errors = reports |> Enum.filter(&(&1.severity == :error)) |> Enum.reduce(0, &(&1.count + &2))
    warnings = reports |> Enum.filter(&(&1.severity == :warning)) |> Enum.reduce(0, &(&1.count + &2))

    IO.puts("\nTotal: #{total} issues (#{errors} errors, #{warnings} warnings)")
  end

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, val), do: Keyword.put(opts, key, val)

  defp maybe_put_checks(opts, nil), do: opts

  defp maybe_put_checks(opts, check_str) do
    check = String.to_existing_atom(check_str)
    Keyword.put(opts, :checks, [check])
  rescue
    ArgumentError -> opts
  end
end
