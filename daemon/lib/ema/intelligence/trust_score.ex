defmodule Ema.Intelligence.TrustScore do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "agent_trust_scores" do
    field :agent_id, :string
    field :score, :integer, default: 50
    field :completion_rate, :float, default: 0.0
    field :avg_latency_ms, :integer, default: 0
    field :error_count, :integer, default: 0
    field :session_count, :integer, default: 0
    field :days_active, :integer, default: 0
    field :calculated_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  def changeset(score, attrs) do
    score
    |> cast(attrs, [:id, :agent_id, :score, :completion_rate, :avg_latency_ms, :error_count, :session_count, :days_active, :calculated_at])
    |> validate_required([:id, :agent_id, :score, :calculated_at])
    |> validate_number(:score, greater_than_or_equal_to: 0, less_than_or_equal_to: 100)
  end
end
