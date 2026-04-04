defmodule Ema.Prompts.Prompt do
  @moduledoc """
  Schema for versioned, A/B-testable prompts stored in the DB.

  Columns:
    id             - string primary key (generated)
    version        - integer, incremented per kind when a new version is saved
    kind           - string identifier for the prompt's purpose
                     (e.g. "proposal_generator", "context_builder", "debate_refiner")
    content        - the prompt body (text)
    a_b_test_group - optional group label for A/B testing ("control", "variant_a", etc.)
    metrics        - map of outcome signals (usage_count, success_rate, avg_score, etc.)
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "prompts" do
    field :version,        :integer, default: 1
    field :kind,           :string
    field :content,        :string
    field :a_b_test_group, :string
    field :metrics,        :map,    default: %{}

    timestamps(type: :utc_datetime)
  end

  def changeset(prompt, attrs) do
    prompt
    |> cast(attrs, [:id, :version, :kind, :content, :a_b_test_group, :metrics])
    |> validate_required([:id, :kind, :content])
    |> validate_number(:version, greater_than: 0)
    |> validate_length(:kind, min: 1, max: 128)
    |> validate_length(:content, min: 1)
  end
end
