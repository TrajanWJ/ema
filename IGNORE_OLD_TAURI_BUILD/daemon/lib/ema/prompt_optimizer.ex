defmodule Ema.PromptOptimizer do
  @moduledoc "Thin alias for Ema.Prompts.Optimizer. See that module for full implementation."

  defdelegate start_link(opts \\ []), to: Ema.Prompts.Optimizer
  defdelegate optimize(server \\ Ema.Prompts.Optimizer), to: Ema.Prompts.Optimizer
  defdelegate status(server \\ Ema.Prompts.Optimizer), to: Ema.Prompts.Optimizer
  defdelegate next_run_after(now), to: Ema.Prompts.Optimizer
  defdelegate ms_until_next_run(), to: Ema.Prompts.Optimizer
end
