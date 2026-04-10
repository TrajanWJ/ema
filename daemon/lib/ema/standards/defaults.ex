defmodule Ema.Standards.Defaults do
  @moduledoc """
  Default-value helpers used at the boundaries of EMA contexts so that
  callers don't have to remember every "best practice" field. Pure
  functions over attribute maps — no DB access here.

  Usage from a context module (e.g. `Ema.Tasks.create_task/1`):

      attrs
      |> Ema.Standards.Defaults.task_attrs()
      |> Task.changeset(...)

  Each function is idempotent: it never overrides a value the caller
  explicitly provided.
  """

  @doc """
  Fill in defaults for a task. Uses the active project (if not set)
  and stamps the human actor.
  """
  @spec task_attrs(map()) :: map()
  def task_attrs(attrs) when is_map(attrs) do
    attrs
    |> put_default_lazy(:project_id, &active_project_id/0)
    |> put_default_lazy(:actor_id, &human_actor_id/0)
  end

  @doc "Fill in defaults for a proposal — defaults the actor to human."
  @spec proposal_attrs(map()) :: map()
  def proposal_attrs(attrs) when is_map(attrs) do
    put_default_lazy(attrs, :actor_id, &human_actor_id/0)
  end

  @doc """
  Fill in defaults for an execution. Sets `origin` if missing
  (defaults to `\"manual\"`) and stamps the human actor.
  """
  @spec execution_attrs(map(), String.t()) :: map()
  def execution_attrs(attrs, default_origin \\ "manual") when is_map(attrs) do
    attrs
    |> put_default(:origin, default_origin)
    |> put_default_lazy(:actor_id, &human_actor_id/0)
  end

  ## Resolvers — each is defensive and returns nil on failure.

  defp active_project_id do
    safe(fn ->
      cond do
        Code.ensure_loaded?(Ema.Settings) and
            function_exported?(Ema.Settings, :get, 1) ->
          Ema.Settings.get("active_project_id")

        true ->
          nil
      end
    end)
  end

  defp human_actor_id do
    safe(fn ->
      mod = Ema.Actors

      cond do
        Code.ensure_loaded?(mod) and function_exported?(mod, :human_actor, 0) ->
          case apply(mod, :human_actor, []) do
            %{id: id} -> id
            _ -> nil
          end

        true ->
          nil
      end
    end)
  end

  defp put_default(attrs, key, value) do
    cond do
      Map.has_key?(attrs, key) and not is_nil(Map.get(attrs, key)) ->
        attrs

      Map.has_key?(attrs, to_string(key)) and not is_nil(Map.get(attrs, to_string(key))) ->
        attrs

      is_nil(value) ->
        attrs

      true ->
        Map.put(attrs, key, value)
    end
  end

  defp put_default_lazy(attrs, key, fun) do
    if has_value?(attrs, key) do
      attrs
    else
      case fun.() do
        nil -> attrs
        value -> Map.put(attrs, key, value)
      end
    end
  end

  defp has_value?(attrs, key) do
    (Map.has_key?(attrs, key) and not is_nil(Map.get(attrs, key))) or
      (Map.has_key?(attrs, to_string(key)) and not is_nil(Map.get(attrs, to_string(key))))
  end

  defp safe(fun) do
    try do
      fun.()
    rescue
      _ -> nil
    catch
      _, _ -> nil
    end
  end
end
