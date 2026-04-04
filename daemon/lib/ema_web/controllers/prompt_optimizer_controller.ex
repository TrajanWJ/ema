defmodule EmaWeb.PromptOptimizerController do
  use EmaWeb, :controller

  def status(conn, _params) do
    json(conn, Ema.Prompts.Optimizer.status())
  end
end
