defmodule Ema.Prompts.PromptTemplate do
  use Ecto.Schema
  import Ecto.Changeset

  @valid_categories ~w(system agent task custom)

  schema "prompt_templates" do
    field :name, :string
    field :category, :string
    field :body, :string
    field :variables, {:array, :string}, default: []
    field :version, :integer, default: 1

    belongs_to :parent, __MODULE__

    timestamps(type: :utc_datetime)
  end

  def changeset(template, attrs) do
    template
    |> cast(attrs, [:name, :category, :body, :variables, :version, :parent_id])
    |> validate_required([:name, :category, :body])
    |> validate_inclusion(:category, @valid_categories)
    |> validate_number(:version, greater_than: 0)
  end
end
