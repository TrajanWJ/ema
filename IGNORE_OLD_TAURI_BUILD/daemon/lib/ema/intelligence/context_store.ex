defmodule Ema.Intelligence.ContextStore do
  @moduledoc """
  Stores indexed code and note fragments for prompt enrichment.
  """

  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query

  alias Ema.Repo

  @primary_key {:id, :string, autogenerate: false}
  @valid_types ~w(code note summary)

  schema "context_fragments" do
    field :project_slug, :string
    field :fragment_type, :string
    field :content, :string
    field :file_path, :string
    field :relevance_score, :float, default: 0.0

    timestamps(updated_at: false, type: :utc_datetime)
  end

  def changeset(fragment, attrs) do
    fragment
    |> cast(attrs, [:id, :project_slug, :fragment_type, :content, :file_path, :relevance_score])
    |> validate_required([:id, :project_slug, :fragment_type, :content, :relevance_score])
    |> validate_inclusion(:fragment_type, @valid_types)
    |> validate_number(:relevance_score,
      greater_than_or_equal_to: 0.0,
      less_than_or_equal_to: 1.0
    )
  end

  def create_fragment(attrs) do
    %__MODULE__{}
    |> changeset(Map.put_new(attrs, :id, generate_id()))
    |> Repo.insert()
  end

  def replace_project_code_fragments(project_slug, fragments) when is_list(fragments) do
    Repo.transaction(fn ->
      from(cf in __MODULE__,
        where: cf.project_slug == ^project_slug and cf.fragment_type == "code"
      )
      |> Repo.delete_all()

      Enum.map(fragments, fn attrs ->
        attrs
        |> Map.put(:project_slug, project_slug)
        |> Map.put(:fragment_type, "code")
        |> Map.put_new(:id, generate_id())
      end)
      |> Enum.reduce_while([], fn attrs, acc ->
        case create_fragment(attrs) do
          {:ok, fragment} -> {:cont, [fragment | acc]}
          {:error, changeset} -> Repo.rollback(changeset)
        end
      end)
      |> Enum.reverse()
    end)
  end

  def list_fragments(project_slug, opts \\ []) do
    __MODULE__
    |> where([cf], cf.project_slug == ^project_slug)
    |> maybe_filter_type(opts[:fragment_type])
    |> order_by([cf], desc: cf.relevance_score, desc: cf.inserted_at)
    |> maybe_limit(opts[:limit])
    |> Repo.all()
  end

  defp maybe_filter_type(query, nil), do: query

  defp maybe_filter_type(query, type) do
    where(query, [cf], cf.fragment_type == ^to_string(type))
  end

  defp maybe_limit(query, nil), do: query
  defp maybe_limit(query, limit), do: limit(query, ^limit)

  defp generate_id do
    "ctx_" <>
      (System.system_time(:microsecond) |> Integer.to_string()) <>
      "_" <> Base.encode16(:crypto.strong_rand_bytes(4), case: :lower)
  end
end
