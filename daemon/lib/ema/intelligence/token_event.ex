defmodule Ema.Intelligence.TokenEvent do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "token_events" do
    field :session_id, :string
    field :agent_id, :string
    field :model, :string
    field :input_tokens, :integer, default: 0
    field :output_tokens, :integer, default: 0
    field :cost_usd, :float, default: 0.0
    field :source, :string, default: "unknown"

    timestamps(type: :utc_datetime)
  end

  @valid_sources ~w(agent_session superman claude_bridge manual)

  def changeset(event, attrs) do
    event
    |> cast(attrs, [:id, :session_id, :agent_id, :model, :input_tokens, :output_tokens, :cost_usd, :source])
    |> validate_required([:id, :model, :input_tokens, :output_tokens, :cost_usd])
    |> maybe_validate_inclusion(:source, @valid_sources)
  end

  defp maybe_validate_inclusion(changeset, field, values) do
    case get_change(changeset, field) do
      nil -> changeset
      _ -> validate_inclusion(changeset, field, values)
    end
  end
end
