defmodule EmaWeb.DispatchController do
  use EmaWeb, :controller

  action_fallback EmaWeb.FallbackController

  @doc """
  POST /api/dispatch/async
  Body: %{"prompt" => "...", "opts" => %{...}}
  Returns: %{task_id: "...", status: "dispatched"}

  Non-blocking Claude dispatch. Subscribe to PubSub "claude:task:<task_id>"
  for completion notification.
  """
  def async(conn, %{"prompt" => prompt} = params) do
    opts =
      params
      |> Map.get("opts", %{})
      |> Enum.map(fn {k, v} -> {String.to_existing_atom(k), v} end)

    case Ema.Claude.Bridge.spawn_async(prompt, opts) do
      {:ok, task_id} ->
        json(conn, %{task_id: task_id, status: "dispatched"})

      {:error, reason} ->
        conn
        |> put_status(503)
        |> json(%{error: "dispatch failed", reason: inspect(reason)})
    end
  end

  def async(conn, _params) do
    conn |> put_status(400) |> json(%{error: "prompt is required"})
  end
end
