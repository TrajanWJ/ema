defmodule Ema.MetaMind.PromptLibrary do
  @moduledoc """
  Ecto schema and context functions for storing reusable prompts
  with categories, tags, effectiveness scores, and version history.
  """

  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query

  alias Ema.Repo

  @primary_key {:id, :string, autogenerate: false}

  schema "metamind_prompts" do
    field :name, :string
    field :body, :string
    field :category, :string
    field :tags, {:array, :string}, default: []
    field :version, :integer, default: 1
    field :effectiveness_score, :float, default: 0.0
    field :usage_count, :integer, default: 0
    field :success_count, :integer, default: 0
    field :metadata, :map, default: %{}
    field :parent_id, :string
    field :template_vars, {:array, :string}, default: []

    timestamps(type: :utc_datetime)
  end

  @valid_categories ~w(system review metaprompt template technique research)

  def changeset(prompt, attrs) do
    prompt
    |> cast(attrs, [
      :id, :name, :body, :category, :tags, :version,
      :effectiveness_score, :usage_count, :success_count,
      :metadata, :parent_id, :template_vars
    ])
    |> validate_required([:id, :name, :body, :category])
    |> validate_inclusion(:category, @valid_categories)
    |> validate_number(:effectiveness_score,
      greater_than_or_equal_to: 0.0,
      less_than_or_equal_to: 1.0
    )
    |> unique_constraint(:id, name: :metamind_prompts_pkey)
  end

  # --- Context Functions ---

  def save_prompt(attrs) do
    id = Map.get(attrs, :id) || Map.get(attrs, "id") || Ecto.UUID.generate()
    attrs = Map.put(attrs, :id, id)

    %__MODULE__{}
    |> changeset(attrs)
    |> Repo.insert(on_conflict: :replace_all, conflict_target: :id)
  end

  def search_prompts(query_string) do
    pattern = "%#{query_string}%"

    from(p in __MODULE__,
      where: ilike(p.name, ^pattern) or ilike(p.body, ^pattern),
      order_by: [desc: p.effectiveness_score, desc: p.usage_count]
    )
    |> Repo.all()
  end

  def get_best_for_category(category, limit \\ 5) do
    from(p in __MODULE__,
      where: p.category == ^category,
      order_by: [desc: p.effectiveness_score, desc: p.usage_count],
      limit: ^limit
    )
    |> Repo.all()
  end

  def list_prompts do
    from(p in __MODULE__, order_by: [desc: p.updated_at])
    |> Repo.all()
  end

  def get_prompt(id), do: Repo.get(__MODULE__, id)

  def track_outcome(id, success?) do
    case Repo.get(__MODULE__, id) do
      nil ->
        {:error, :not_found}

      prompt ->
        new_usage = prompt.usage_count + 1
        new_success = if success?, do: prompt.success_count + 1, else: prompt.success_count
        score = new_success / max(new_usage, 1)

        prompt
        |> changeset(%{
          usage_count: new_usage,
          success_count: new_success,
          effectiveness_score: Float.round(score, 3)
        })
        |> Repo.update()
    end
  end

  def delete_prompt(id) do
    case Repo.get(__MODULE__, id) do
      nil -> {:error, :not_found}
      prompt -> Repo.delete(prompt)
    end
  end

  def get_by_tags(tags) when is_list(tags) do
    from(p in __MODULE__,
      where: fragment("EXISTS (SELECT 1 FROM json_each(?) WHERE value IN (?))",
        p.tags, ^tags),
      order_by: [desc: p.effectiveness_score]
    )
    |> Repo.all()
  end

  def create_version(parent_id, new_body) do
    case Repo.get(__MODULE__, parent_id) do
      nil ->
        {:error, :not_found}

      parent ->
        save_prompt(%{
          name: parent.name,
          body: new_body,
          category: parent.category,
          tags: parent.tags,
          version: parent.version + 1,
          parent_id: parent.id,
          template_vars: parent.template_vars,
          metadata: Map.put(parent.metadata, "forked_from", parent.id)
        })
    end
  end
end
