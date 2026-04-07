defmodule Ema.CLI.Commands.Vault do
  @moduledoc "CLI commands for the knowledge vault (Second Brain)."

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
          {:ok, tree} ->
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
              Output.info("Vault Graph: #{length(nodes)} nodes, #{length(edges)} edges")
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
              Output.info("Vault Graph: #{length(nodes)} nodes, #{length(edges)} edges")
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

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown vault subcommand: #{inspect(sub)}")
  end

  defp print_tree(tree, indent) when is_map(tree) do
    name = tree["name"] || Map.get(tree, :name, "")
    children = tree["children"] || Map.get(tree, :children, [])

    if name != "" do
      IO.puts("#{indent}#{name}/")
    end

    Enum.each(children, &print_tree(&1, indent <> "  "))
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
end
