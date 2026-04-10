defmodule Ema.Intents.Schematic.Target do
  @moduledoc """
  Resolves dotted scope paths to space/project/subproject/intent tuples.

  Path grammar:

      <space>[.<project>[.<subproject>...][.<intent>]]

  Examples:

    * `personal`                                  → entire personal space
    * `personal.ema`                              → ema project in personal space
    * `personal.ema.execution-system`             → subproject of ema
    * `personal.ema.execution-system.fix-foo`    → intent under that subproject

  At depth 3+ each segment is tried first as a subproject (project with
  parent_id pointing at the previous project), then as an intent slug
  scoped to the current project.

  Resolved targets are returned as maps with the keys
  `:space`, `:project`, `:subproject`, `:intent`. Missing levels are `nil`.
  Errors come back as `{:error, reason}`.
  """

  import Ecto.Query

  alias Ema.Repo
  alias Ema.Spaces.Space
  alias Ema.Projects.Project
  alias Ema.Intents.Intent

  @type target :: %{
          space: Space.t() | nil,
          project: Project.t() | nil,
          subproject: Project.t() | nil,
          intent: Intent.t() | nil,
          path: String.t()
        }

  @doc "Parse a dotted path into trimmed parts."
  @spec parse(String.t()) :: [String.t()]
  def parse(path) when is_binary(path) do
    path
    |> String.split(".", trim: true)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  @doc """
  Resolve a dotted path into a target struct.

  Returns `{:ok, target}` on success or
  `{:error, {:not_found, level, slug}}` when a segment can't be resolved.
  Walks as deep as possible — once a level is found the next level is
  resolved relative to it.
  """
  @spec resolve(String.t()) :: {:ok, target()} | {:error, term()}
  def resolve(path) when is_binary(path) do
    case parse(path) do
      [] ->
        {:error, :empty_path}

      [space_slug] ->
        with {:ok, space} <- find_space(space_slug) do
          {:ok, build_target(space, nil, nil, nil)}
        end

      [space_slug, project_slug] ->
        with {:ok, space} <- find_space(space_slug),
             {:ok, project} <- find_project(space, project_slug) do
          {:ok, build_target(space, project, nil, nil)}
        end

      [space_slug, project_slug | rest] ->
        with {:ok, space} <- find_space(space_slug),
             {:ok, project} <- find_project(space, project_slug) do
          resolve_nested(space, project, rest)
        end
    end
  end

  @doc """
  Build a dotted path string from a target map.

  Accepts maps with any subset of `:space`, `:project`, `:subproject`,
  `:intent`. Each present key contributes its slug (or id for spaces).
  """
  @spec to_path(map()) :: String.t()
  def to_path(%{} = target) do
    [
      target |> Map.get(:space) |> space_slug(),
      target |> Map.get(:project) |> project_slug(),
      target |> Map.get(:subproject) |> project_slug(),
      target |> Map.get(:intent) |> intent_slug()
    ]
    |> Enum.reject(&is_nil/1)
    |> Enum.join(".")
  end

  @doc """
  List all valid scope paths in the system.

  Walks every space → project → subproject → top-level intent. Used by
  CLI completion and the schematic listing UI.
  """
  @spec list_paths() :: [String.t()]
  def list_paths do
    spaces = Repo.all(from s in Space, where: is_nil(s.archived_at))

    Enum.flat_map(spaces, fn space ->
      space_path = space_slug(space)
      [space_path | list_project_paths(space, space_path)]
    end)
  end

  defp list_project_paths(space, space_path) do
    root_projects =
      Repo.all(
        from p in Project,
          where: p.space_id == ^space.id and is_nil(p.parent_id),
          order_by: p.slug
      )

    Enum.flat_map(root_projects, fn project ->
      project_path = "#{space_path}.#{project.slug}"
      [project_path | list_subproject_paths(project, project_path)]
    end)
  end

  defp list_subproject_paths(project, project_path) do
    children =
      Repo.all(
        from p in Project,
          where: p.parent_id == ^project.id,
          order_by: p.slug
      )

    intents = list_top_level_intents(project)

    intent_paths =
      Enum.map(intents, fn intent -> "#{project_path}.#{intent.slug}" end)

    sub_paths =
      Enum.flat_map(children, fn child ->
        sub_path = "#{project_path}.#{child.slug}"
        [sub_path | list_subproject_paths(child, sub_path)]
      end)

    sub_paths ++ intent_paths
  end

  @doc """
  Return all intents under a target (transitively).

  * Space target → all intents whose project belongs to the space.
  * Project target → all intents under that project (no recursion into
    subprojects — those are separate projects).
  * Subproject target → same as project.
  * Intent target → the intent plus all its descendants.
  """
  @spec intents_in_scope(target()) :: [Intent.t()]
  def intents_in_scope(%{intent: %Intent{} = intent}) do
    [intent | Ema.Intents.descendants(intent.id)]
  end

  def intents_in_scope(%{subproject: %Project{} = sub}) do
    intents_for_project(sub.id)
  end

  def intents_in_scope(%{project: %Project{} = project, subproject: nil}) do
    intents_for_project_tree(project)
  end

  def intents_in_scope(%{space: %Space{} = space, project: nil}) do
    project_ids =
      Repo.all(from p in Project, where: p.space_id == ^space.id, select: p.id)

    Repo.all(from i in Intent, where: i.project_id in ^project_ids)
  end

  def intents_in_scope(_), do: []

  # ── Resolution helpers ────────────────────────────────────────────

  defp resolve_nested(space, project, segments) do
    do_resolve_nested(space, project, project, segments)
  end

  # current_project is the deepest project resolved so far.
  defp do_resolve_nested(space, root_project, current_project, []) do
    subproject = if current_project.id == root_project.id, do: nil, else: current_project
    {:ok, build_target(space, root_project, subproject, nil)}
  end

  defp do_resolve_nested(space, root_project, current_project, [segment | rest]) do
    case find_subproject(current_project, segment) do
      {:ok, sub} ->
        do_resolve_nested(space, root_project, sub, rest)

      :not_found ->
        case find_intent(current_project, segment) do
          {:ok, intent} when rest == [] ->
            subproject =
              if current_project.id == root_project.id, do: nil, else: current_project

            {:ok, build_target(space, root_project, subproject, intent)}

          {:ok, _intent} ->
            # Intents don't nest via dotted slugs in this resolver — bail.
            {:error, {:not_found, :subproject, segment}}

          :not_found ->
            {:error, {:not_found, :subproject_or_intent, segment}}
        end
    end
  end

  defp find_space(slug) do
    case lookup_space(slug) do
      nil -> {:error, {:not_found, :space, slug}}
      space -> {:ok, space}
    end
  end

  # Spaces have no slug column, so accept several conventions:
  # exact id match, then space_type match, then slugified name match.
  defp lookup_space(slug) do
    by_id = Repo.get(Space, slug)
    if by_id, do: by_id, else: lookup_space_by_type_or_name(slug)
  end

  defp lookup_space_by_type_or_name(slug) do
    Repo.all(from s in Space, where: is_nil(s.archived_at))
    |> Enum.find(fn s ->
      s.space_type == slug or slugify(s.name) == slug
    end)
  end

  defp find_project(%Space{id: space_id}, slug) do
    case Repo.one(
           from p in Project,
             where: p.space_id == ^space_id and p.slug == ^slug and is_nil(p.parent_id),
             limit: 1
         ) do
      nil -> {:error, {:not_found, :project, slug}}
      project -> {:ok, project}
    end
  end

  defp find_subproject(%Project{id: parent_id}, slug) do
    case Repo.one(
           from p in Project,
             where: p.parent_id == ^parent_id and p.slug == ^slug,
             limit: 1
         ) do
      nil -> :not_found
      project -> {:ok, project}
    end
  end

  defp find_intent(%Project{id: project_id}, slug) do
    case Repo.one(
           from i in Intent,
             where: i.project_id == ^project_id and i.slug == ^slug and is_nil(i.parent_id),
             limit: 1
         ) do
      nil -> :not_found
      intent -> {:ok, intent}
    end
  end

  defp list_top_level_intents(%Project{id: project_id}) do
    Repo.all(
      from i in Intent,
        where: i.project_id == ^project_id and is_nil(i.parent_id),
        order_by: i.slug
    )
  end

  defp intents_for_project(project_id) do
    Repo.all(from i in Intent, where: i.project_id == ^project_id)
  end

  defp intents_for_project_tree(%Project{id: project_id}) do
    sub_ids =
      Repo.all(from p in Project, where: p.parent_id == ^project_id, select: p.id)

    ids = [project_id | sub_ids]
    Repo.all(from i in Intent, where: i.project_id in ^ids)
  end

  defp build_target(space, project, subproject, intent) do
    target = %{
      space: space,
      project: project,
      subproject: subproject,
      intent: intent
    }

    Map.put(target, :path, to_path(target))
  end

  defp space_slug(nil), do: nil
  defp space_slug(%Space{space_type: t, name: name, id: id}) do
    cond do
      is_binary(t) and t != "" -> t
      is_binary(name) and name != "" -> slugify(name)
      true -> id
    end
  end

  defp project_slug(nil), do: nil
  defp project_slug(%Project{slug: slug}), do: slug

  defp intent_slug(nil), do: nil
  defp intent_slug(%Intent{slug: slug}), do: slug

  defp slugify(text) when is_binary(text) do
    text
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s-]/, "")
    |> String.replace(~r/\s+/, "-")
    |> String.trim("-")
  end

  defp slugify(_), do: ""
end
