defmodule Ema.Tasks.Comment do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "task_comments" do
    field :body, :string
    field :source, :string, default: "user"

    belongs_to :task, Ema.Tasks.Task, type: :string

    timestamps(type: :utc_datetime)
  end

  @valid_sources ~w(user system agent)

  def changeset(comment, attrs) do
    comment
    |> cast(attrs, [:id, :body, :source, :task_id])
    |> validate_required([:id, :body, :task_id])
    |> validate_inclusion(:source, @valid_sources)
  end
end
