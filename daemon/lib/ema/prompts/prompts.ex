defmodule Ema.Prompts do
  @moduledoc """
  Prompt templates — reusable, versioned prompt templates for AI interactions.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Prompts.PromptTemplate

  def list_templates do
    PromptTemplate
    |> order_by(desc: :updated_at)
    |> Repo.all()
  end

  def get_template!(id), do: Repo.get!(PromptTemplate, id)

  def create_template(attrs) do
    %PromptTemplate{}
    |> PromptTemplate.changeset(attrs)
    |> Repo.insert()
  end

  def update_template(%PromptTemplate{} = template, attrs) do
    template
    |> PromptTemplate.changeset(attrs)
    |> Repo.update()
  end

  def delete_template(%PromptTemplate{} = template) do
    Repo.delete(template)
  end

  @doc """
  Creates a new version of an existing template.
  The new template has parent_id pointing to the original and an incremented version.
  """
  def create_version(%PromptTemplate{} = original, attrs) do
    merged =
      %{
        name: original.name,
        category: original.category,
        body: original.body,
        variables: original.variables,
        version: original.version + 1,
        parent_id: original.id
      }
      |> Map.merge(attrs)

    %PromptTemplate{}
    |> PromptTemplate.changeset(merged)
    |> Repo.insert()
  end
end
