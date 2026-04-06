defmodule EmaWeb.SessionOrchestratorController do
  use EmaWeb, :controller

  alias Ema.Sessions.Orchestrator

  def index(conn, params) do
    active_only = params["active_only"] == "true"

    result =
      if active_only do
        Orchestrator.list_active()
      else
        Orchestrator.list_all(limit: parse_int(params["limit"], 30))
      end

    {:ok, sessions} = result
    json(conn, %{sessions: sessions, count: length(sessions)})
  end

  def show(conn, %{"id" => id}) do
    case Orchestrator.get_session_detail(id) do
      {:ok, session} ->
        json(conn, %{session: session})

      {:error, reason} ->
        conn |> put_status(404) |> json(%{error: reason})
    end
  end

  def spawn(conn, params) do
    prompt = params["prompt"] || ""

    opts = [
      project_slug: params["project_slug"],
      task_id: params["task_id"],
      model: params["model"] || "sonnet",
      inject_context: params["inject_context"] != false,
      proposal_id: params["proposal_id"]
    ]

    case Orchestrator.spawn(prompt, opts) do
      {:ok, result} ->
        conn |> put_status(201) |> json(%{session: result})

      {:error, reason} ->
        conn |> put_status(422) |> json(%{error: inspect(reason)})
    end
  end

  def resume(conn, %{"id" => id} = params) do
    prompt = params["prompt"] || ""

    case Orchestrator.resume(id, prompt) do
      {:ok, result} ->
        json(conn, %{session: result})

      {:error, reason} ->
        conn |> put_status(422) |> json(%{error: reason})
    end
  end

  def kill(conn, %{"id" => id}) do
    case Orchestrator.kill(id) do
      {:ok, result} ->
        json(conn, result)

      {:error, reason} ->
        conn |> put_status(422) |> json(%{error: reason})
    end
  end

  def check(conn, %{"id" => id}) do
    case Orchestrator.check_session(id) do
      {:error, reason} ->
        conn |> put_status(404) |> json(%{error: reason})

      status ->
        json(conn, %{session: status})
    end
  end

  def context(conn, params) do
    opts = [project_slug: params["project_slug"]]

    {:ok, context} = Orchestrator.build_context(opts)
    json(conn, %{context: context})
  end

  def context_prompt(conn, params) do
    opts = [project_slug: params["project_slug"]]

    {:ok, prompt} = Orchestrator.context_prompt(opts)
    json(conn, %{prompt: prompt})
  end

  defp parse_int(nil, default), do: default
  defp parse_int(val, default) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      :error -> default
    end
  end
  defp parse_int(val, _default) when is_integer(val), do: val
end
