defmodule Ema.Agents.Template do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "agent_templates" do
    field :name, :string
    field :command, :string
    field :description, :string
    field :icon, :string

    has_many :runs, Ema.Agents.Run

    timestamps(type: :utc_datetime)
  end

  def changeset(template, attrs) do
    template
    |> cast(attrs, [:id, :name, :command, :description, :icon])
    |> validate_required([:id, :name, :command])
  end
end
