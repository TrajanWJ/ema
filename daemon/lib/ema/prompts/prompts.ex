defmodule Ema.Prompts do
  @moduledoc """
  Prompt Workshop context — CRUD for prompt templates with versioning.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Prompts.PromptTemplate

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end

  def list_templates(opts \\ []) do
    PromptTemplate
    |> maybe_filter_category(opts[:category])
    |> order_by(desc: :updated_at)
    |> Repo.all()
  end

  def get_template(id), do: Repo.get(PromptTemplate, id)

  def create_template(attrs) do
    id = generate_id("tpl")

    %PromptTemplate{}
    |> PromptTemplate.changeset(Map.put(attrs, :id, id))
    |> Repo.insert()
    |> tap_ok(&broadcast("template_created", &1))
  end

  def update_template(%PromptTemplate{} = template, attrs) do
    template
    |> PromptTemplate.changeset(attrs)
    |> Repo.update()
    |> tap_ok(&broadcast("template_updated", &1))
  end

  def delete_template(%PromptTemplate{} = template) do
    Repo.delete(template)
    |> tap_ok(fn _ -> broadcast("template_deleted", %{id: template.id}) end)
  end

  @doc "Create a new version forked from an existing template."
  def fork_template(id, attrs) do
    case get_template(id) do
      nil ->
        {:error, :not_found}

      parent ->
        new_attrs =
          Map.merge(
            %{
              name: parent.name,
              category: parent.category,
              body: parent.body,
              variables: parent.variables,
              version: parent.version + 1,
              parent_id: parent.id
            },
            attrs
          )

        create_template(new_attrs)
    end
  end

  def get_version_history(id) do
    case get_template(id) do
      nil ->
        {:error, :not_found}

      template ->
        # Walk up the parent chain
        ancestors = collect_ancestors(template.parent_id, [])
        # Find children
        children =
          PromptTemplate
          |> where([t], t.parent_id == ^id)
          |> order_by(asc: :version)
          |> Repo.all()

        {:ok, %{current: template, ancestors: ancestors, children: children}}
    end
  end

  defp collect_ancestors(nil, acc), do: Enum.reverse(acc)

  defp collect_ancestors(parent_id, acc) do
    case Repo.get(PromptTemplate, parent_id) do
      nil -> Enum.reverse(acc)
      parent -> collect_ancestors(parent.parent_id, [parent | acc])
    end
  end

  defp maybe_filter_category(query, nil), do: query
  defp maybe_filter_category(query, cat), do: where(query, [t], t.category == ^cat)

  defp tap_ok({:ok, val} = result, fun) do
    fun.(val)
    result
  end

  defp tap_ok(error, _fun), do: error

  defp broadcast(event, payload) do
    EmaWeb.Endpoint.broadcast("prompts:lobby", event, serialize(payload))
  end

  def serialize(%PromptTemplate{} = t) do
    %{
      id: t.id,
      name: t.name,
      category: t.category,
      body: t.body,
      variables: decode_json(t.variables),
      version: t.version,
      parent_id: t.parent_id,
      created_at: t.inserted_at,
      updated_at: t.updated_at
    }
  end

  def serialize(%{id: _} = map), do: map

  defp decode_json(nil), do: []

  defp decode_json(str) when is_binary(str) do
    case Jason.decode(str) do
      {:ok, val} -> val
      _ -> []
    end
  end

  defp decode_json(other), do: other
end
