defmodule Ema.CliManager.CliTool do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "cli_tools" do
    field :name, :string
    field :binary_path, :string
    field :version, :string
    field :capabilities, :string, default: "[]"
    field :session_dir, :string
    field :detected_at, :utc_datetime

    has_many :sessions, Ema.CliManager.CliSession, foreign_key: :cli_tool_id

    timestamps(type: :utc_datetime)
  end

  def changeset(tool, attrs) do
    tool
    |> cast(attrs, [:id, :name, :binary_path, :version, :capabilities, :session_dir, :detected_at])
    |> validate_required([:name, :binary_path])
    |> unique_constraint(:name)
  end

  def capabilities_list(%__MODULE__{capabilities: caps}) when is_binary(caps) do
    case Jason.decode(caps) do
      {:ok, list} when is_list(list) -> list
      _ -> []
    end
  end

  def capabilities_list(_), do: []
end
