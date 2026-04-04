defmodule Ema.Intelligence.SupermanRuntime do
  @moduledoc """
  Reads `.superman/` folders from a project's linked paths and assembles
  project intelligence context for prompt injection.

  Expected `.superman/` structure:
    identity.md      — project identity / persona
    constraints.md   — hard rules and boundaries
    context.md       — background context
    intents/*.md     — intent files with YAML frontmatter `status: active|paused|done`
  """

  require Logger

  @superman_dir ".superman"
  @status_regex ~r/^status:\s*(\w+)/m

  @doc """
  Build context from `.superman/` folders found in the project's linked paths.

  Returns `{:ok, context_map}` or `{:error, :no_superman}`.
  """
  def context_for(%{linked_path: nil}), do: {:error, :no_superman}

  def context_for(%{linked_path: linked_path}) do
    paths = linked_paths(linked_path)

    results =
      paths
      |> Enum.map(&read_folder/1)
      |> Enum.reject(&is_nil/1)

    case results do
      [] -> {:error, :no_superman}
      [ctx | _] -> {:ok, ctx}
    end
  end

  def context_for(_), do: {:error, :no_superman}

  @doc """
  Read a `.superman/` folder at the given base path.

  Returns a context map or nil if the folder doesn't exist.
  """
  def read_folder(base_path) do
    superman_path = Path.join(base_path, @superman_dir)

    if File.dir?(superman_path) do
      %{
        identity: read_file(superman_path, "identity.md"),
        constraints: read_file(superman_path, "constraints.md"),
        context: read_file(superman_path, "context.md"),
        active_intents: read_active_intents(superman_path)
      }
    else
      nil
    end
  end

  @doc """
  Format a context map into a prompt-ready string.
  """
  def format_for_prompt(nil), do: ""

  def format_for_prompt(ctx) do
    parts =
      [
        section("Identity", ctx[:identity]),
        section("Active Intents", format_intents(ctx[:active_intents])),
        section("Constraints", ctx[:constraints])
      ]
      |> Enum.reject(&(&1 == ""))

    if parts == [] do
      ""
    else
      "## Project Intelligence\n" <> Enum.join(parts, "\n\n")
    end
  end

  # -- Private ----------------------------------------------------------------

  defp linked_paths(path) when is_binary(path) do
    path
    |> String.split(",")
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.map(&Path.expand/1)
  end

  defp read_file(dir, filename) do
    path = Path.join(dir, filename)

    case File.read(path) do
      {:ok, content} -> String.trim(content)
      _ -> nil
    end
  end

  defp read_active_intents(superman_path) do
    intents_dir = Path.join(superman_path, "intents")

    if File.dir?(intents_dir) do
      intents_dir
      |> File.ls!()
      |> Enum.filter(&String.ends_with?(&1, ".md"))
      |> Enum.map(fn filename ->
        content = read_file(intents_dir, filename)
        {filename, content, parse_status(content)}
      end)
      |> Enum.filter(fn {_name, _content, status} -> status == "active" end)
      |> Enum.map(fn {name, content, _status} ->
        %{name: Path.rootname(name), content: strip_frontmatter(content)}
      end)
    else
      []
    end
  rescue
    _ -> []
  end

  defp parse_status(nil), do: nil

  defp parse_status(content) do
    case Regex.run(@status_regex, content) do
      [_, status] -> String.downcase(status)
      _ -> nil
    end
  end

  defp strip_frontmatter(content) do
    case Regex.run(~r/\A---\s*\n.*?\n---\s*\n(.*)/s, content) do
      [_, body] -> String.trim(body)
      _ -> content
    end
  end

  defp section(_label, nil), do: ""
  defp section(_label, ""), do: ""
  defp section(_label, []), do: ""

  defp section(label, content) do
    "### #{label}\n#{content}"
  end

  defp format_intents(nil), do: ""
  defp format_intents([]), do: ""

  defp format_intents(intents) do
    Enum.map_join(intents, "\n\n", fn intent ->
      "#### #{intent.name}\n#{intent.content}"
    end)
  end
end
