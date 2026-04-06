defmodule Ema.CLI.Transport.Direct do
  @moduledoc "In-node transport — calls context modules directly."
  @behaviour Ema.CLI.Transport

  @impl true
  def call(module, function, args) do
    result = apply(module, function, args)

    case result do
      {:ok, _} = ok -> ok
      {:error, _} = err -> err
      %Ecto.Changeset{valid?: false} = cs -> {:error, changeset_errors(cs)}
      other -> {:ok, other}
    end
  rescue
    e -> {:error, Exception.message(e)}
  end

  defp changeset_errors(%Ecto.Changeset{} = cs) do
    Ecto.Changeset.traverse_errors(cs, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
