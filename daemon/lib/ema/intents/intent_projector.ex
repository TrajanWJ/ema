defmodule Ema.Intents.IntentProjector do
  @moduledoc """
  Reverse sync: DB intent changes → wiki intent pages.

  Subscribes to "intents" PubSub topic. When an intent is created or updated
  via API/MCP (not from wiki), writes/updates the corresponding wiki page.
  Uses source_fingerprint to prevent sync loops with the Populator.
  """

  use GenServer
  require Logger

  alias Ema.Intents.Intent

  @level_dirs %{
    0 => "Vision",
    1 => "Goals",
    2 => "Projects",
    3 => "Features",
    4 => "Tasks",
    5 => "Tasks"
  }

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "intents")
    {:ok, %{}}
  end

  @impl true
  def handle_info({"intents:created", intent}, state) do
    maybe_project_to_wiki(intent)
    {:noreply, state}
  end

  def handle_info({"intents:status_changed", intent}, state) do
    maybe_update_wiki_page(intent)
    {:noreply, state}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  defp maybe_project_to_wiki(%{source_type: "wiki"}), do: :ok

  defp maybe_project_to_wiki(intent) when is_map(intent) do
    wiki_dir = wiki_intents_dir()
    level = intent[:level] || intent["level"] || 4
    slug = intent[:slug] || intent["slug"]

    unless slug do
      Logger.debug("[IntentProjector] No slug on intent, skipping")
      :ok
    else
      level_dir = Map.get(@level_dirs, level, "Tasks")
      dir = Path.join([wiki_dir, level_dir])
      File.mkdir_p!(dir)

      filename = slug_to_filename(slug)
      path = Path.join(dir, filename)

      unless File.exists?(path) do
        content = render_wiki_page(intent)
        File.write!(path, content)
        Logger.info("[IntentProjector] Created wiki page: #{path}")
      end
    end
  end

  defp maybe_update_wiki_page(%{source_type: "wiki"}), do: :ok

  defp maybe_update_wiki_page(intent) when is_map(intent) do
    slug = intent[:slug] || intent["slug"]

    if slug do
      case find_wiki_page(slug) do
        nil -> :ok
        path -> update_frontmatter_status(path, intent)
      end
    end
  end

  defp update_frontmatter_status(path, intent) do
    status = m_get(intent, :status)

    case File.read(path) do
      {:ok, content} ->
        updated =
          content
          |> String.replace(
            ~r/intent_status:\s*.+/,
            "intent_status: #{status}"
          )

        if updated != content do
          File.write!(path, updated)
          Logger.debug("[IntentProjector] Updated status in #{path}")
        end

      _ ->
        :ok
    end
  end

  defp render_wiki_page(intent) do
    title = m_get(intent, :title)
    level = m_get(intent, :level) || 4
    kind = m_get(intent, :kind) || "task"
    status = m_get(intent, :status) || "planned"
    priority = m_get(intent, :priority) || 3
    description = m_get(intent, :description) || ""
    project_id = m_get(intent, :project_id)
    parent_id = m_get(intent, :parent_id)

    project_line = if project_id do
      case Ema.Projects.get_project(project_id) do
        %{slug: slug} -> "project: #{slug}"
        _ -> ""
      end
    else
      ""
    end

    parent_line = if parent_id do
      case Ema.Intents.get_intent(parent_id) do
        %{slug: slug} -> "parent: \"[[#{slug_to_title(slug)}]]\""
        _ -> ""
      end
    else
      ""
    end

    lines =
      [
        "---",
        "title: \"#{title}\"",
        "intent_level: #{level}",
        "intent_kind: #{kind}",
        "intent_status: #{status}",
        "intent_priority: #{priority}",
        project_line,
        parent_line,
        "tags: [\"#{kind}\", \"auto-projected\"]",
        "---",
        "",
        "# #{title}",
        "",
        description,
        ""
      ]
      |> Enum.reject(&(&1 == ""))
      |> Enum.join("\n")

    lines <> "\n"
  end

  # Access map fields that could be atom or string keys (serialized intents use atom keys)
  defp m_get(map, key) when is_atom(key) do
    Map.get(map, key) || Map.get(map, to_string(key))
  end

  defp find_wiki_page(slug) do
    wiki_dir = wiki_intents_dir()

    if File.dir?(wiki_dir) do
      Path.wildcard(Path.join(wiki_dir, "**/*.md"))
      |> Enum.find(fn path ->
        basename = Path.basename(path, ".md")
        Ema.Executions.IntentFolder.slugify(basename) == slug
      end)
    end
  end

  defp wiki_intents_dir do
    Path.join([Ema.SecondBrain.vault_root(), "wiki", "Intents"])
  end

  defp slug_to_filename(slug) do
    slug
    |> String.split("-")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join("-")
    |> Kernel.<>(".md")
  end

  defp slug_to_title(slug) do
    slug
    |> String.split("-")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join("-")
  end
end
