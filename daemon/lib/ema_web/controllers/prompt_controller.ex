defmodule EmaWeb.PromptController do
  use EmaWeb, :controller

  alias Ema.Prompts

  action_fallback EmaWeb.FallbackController

  def index(conn, _params) do
    templates = Prompts.list_templates() |> Enum.map(&serialize/1)
    json(conn, %{templates: templates})
  end

  def show(conn, %{"id" => id}) do
    template = Prompts.get_template!(id)
    json(conn, %{template: serialize(template)})
  end

  def create(conn, params) do
    attrs = %{
      name: params["name"],
      category: params["category"],
      body: params["body"],
      variables: params["variables"] || [],
      version: params["version"] || 1
    }

    with {:ok, template} <- Prompts.create_template(attrs) do
      conn
      |> put_status(:created)
      |> json(serialize(template))
    end
  end

  def update(conn, %{"id" => id} = params) do
    template = Prompts.get_template!(id)

    attrs = %{
      name: params["name"],
      category: params["category"],
      body: params["body"],
      variables: params["variables"]
    }

    with {:ok, updated} <- Prompts.update_template(template, attrs) do
      json(conn, serialize(updated))
    end
  end

  def delete(conn, %{"id" => id}) do
    template = Prompts.get_template!(id)

    with {:ok, _} <- Prompts.delete_template(template) do
      json(conn, %{ok: true})
    end
  end

  def create_version(conn, %{"id" => id} = params) do
    original = Prompts.get_template!(id)

    attrs =
      params
      |> Map.take(["name", "category", "body", "variables"])
      |> Map.new(fn {k, v} -> {String.to_existing_atom(k), v} end)

    with {:ok, version} <- Prompts.create_version(original, attrs) do
      conn
      |> put_status(:created)
      |> json(serialize(version))
    end
  end

  defp serialize(template) do
    %{
      id: template.id,
      name: template.name,
      category: template.category,
      body: template.body,
      variables: template.variables,
      version: template.version,
      parent_id: template.parent_id,
      created_at: template.inserted_at,
      updated_at: template.updated_at
    }
  end
end
