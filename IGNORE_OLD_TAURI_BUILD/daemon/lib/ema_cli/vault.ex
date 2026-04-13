defmodule EmaCli.Vault do
  @moduledoc "CLI commands for the knowledge vault"

  import EmaCli.CLI, only: [api_get: 1, format_output: 2, error: 1, warn: 1]

  @vault_root "~/.local/share/ema/vault"

  def run("tree", _opts) do
    root = Path.expand(@vault_root)

    unless File.dir?(root), do: error("Vault not found at #{root}")

    IO.puts("Vault: #{root}\n")
    print_dir_tree(root, "")
  end

  def run("imports", _opts) do
    provenance = Path.expand("#{@vault_root}/imports/_provenance.md")

    if File.exists?(provenance) do
      IO.puts(File.read!(provenance))
    else
      warn("No provenance file at #{provenance}")
    end
  end

  def run("stale", opts) do
    intents_dir = Path.expand("#{@vault_root}/intents")

    unless File.dir?(intents_dir) do
      warn("No intents directory at #{intents_dir}")
    else
      print_stale_files(intents_dir, opts)
    end
  end

  def run("search", opts) do
    query = Map.get(opts, :_arg) || error("Usage: ema vault search <query>")
    k = Map.get(opts, :limit, "5")

    case api_get("/vault/search?q=#{URI.encode(query)}&limit=#{k}") do
      {:ok, %{"notes" => results}} ->
        format_output(results, opts)

      {:ok, results} when is_list(results) ->
        format_output(results, opts)

      {:error, msg} ->
        warn("Vault search unavailable: #{msg}")
    end
  end

  def run(unknown, _),
    do: error("Unknown vault subcommand: #{unknown}. Try: tree, imports, stale, search")

  defp print_dir_tree(path, indent) do
    entries = File.ls!(path) |> Enum.sort()
    {dirs, files} = Enum.split_with(entries, &File.dir?(Path.join(path, &1)))

    Enum.each(dirs, fn dir ->
      full = Path.join(path, dir)
      count = count_files(full)
      IO.puts("#{indent}#{dir}/ (#{count} files)")
      print_dir_tree(full, indent <> "  ")
    end)

    Enum.each(files, fn file ->
      IO.puts("#{indent}#{file}")
    end)
  end

  defp count_files(path) do
    case File.ls(path) do
      {:ok, entries} ->
        Enum.reduce(entries, 0, fn entry, acc ->
          full = Path.join(path, entry)

          if File.dir?(full),
            do: acc + count_files(full),
            else: acc + 1
        end)

      _ ->
        0
    end
  end

  defp print_stale_files(intents_dir, opts) do
    files = list_files_recursive(intents_dir)

    if files == [] do
      IO.puts("No intent projection files found.")
    else
      now = System.os_time(:second)

      rows =
        Enum.map(files, fn path ->
          rel = Path.relative_to(path, Path.expand(@vault_root))
          stat = File.stat!(path, time: :posix)
          age_hours = div(now - stat.mtime, 3600)

          %{
            "path" => rel,
            "age" => format_age(age_hours),
            "size" => "#{stat.size}b"
          }
        end)
        |> Enum.sort_by(& &1["age"], :desc)

      format_output(rows, opts)
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
