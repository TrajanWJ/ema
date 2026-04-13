defmodule EmaWeb.FallbackController do
  use EmaWeb, :controller

  def call(conn, {:error, :not_found}) do
    conn
    |> put_status(:not_found)
    |> json(%{error: "not_found"})
  end

  def call(conn, {:error, :limit_reached}) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: "limit_reached"})
  end

  def call(conn, {:error, :max_habits_reached}) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: "limit_reached", message: "Maximum of 7 active habits"})
  end

  def call(conn, {:error, :cannot_delete_system_pipe}) do
    conn
    |> put_status(:forbidden)
    |> json(%{error: "cannot_delete_system_pipe", message: "System pipes cannot be deleted"})
  end

  def call(conn, {:error, %Ecto.Changeset{} = changeset}) do
    errors =
      Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
        Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
          opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
        end)
      end)

    conn
    |> put_status(:unprocessable_entity)
    |> json(%{errors: errors})
  end
end
