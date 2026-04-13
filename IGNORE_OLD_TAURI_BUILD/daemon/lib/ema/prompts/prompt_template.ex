defmodule Ema.Prompts.PromptTemplate do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "prompt_templates" do
    field :name, :string
    field :category, :string, default: "custom"
    field :body, :string, default: ""
    field :variables, :string, default: "[]"
    field :version, :integer, default: 1
    field :parent_id, :string

    timestamps(type: :utc_datetime)
  end

  @valid_categories ~w(system agent task custom)
  @required_fields ~w(id name category)a
  @optional_fields ~w(body variables version parent_id)a

  def changeset(template, attrs) do
    template
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:category, @valid_categories)
    |> validate_number(:version, greater_than: 0)
  end
end
