defmodule Ema.Claude.Preflight do
  @moduledoc """
  Preflight checks before dispatching to Claude CLI.

  Checks: binary exists, not rate-limited (recent failure count),
  context within token budget. Returns a structured result so callers
  can short-circuit before wasting a CLI spawn.
  """

  alias Ema.Claude.Failure

  require Logger

  @type check_result :: :ok | {:fail, Failure.t()}

  @type result :: %{
          ok: boolean(),
          checks: %{binary: check_result(), rate_limit: check_result(), token_budget: check_result()},
          failure: Failure.t() | nil
        }

  @default_token_budget 180_000
  @rate_limit_window_seconds 300
  @rate_limit_threshold 5

  @doc """
  Run all preflight checks. Returns a result map.

  Options:
    - :prompt — the prompt string (used for token budget estimate)
    - :token_budget — max estimated tokens (default: #{@default_token_budget})
    - :domain — failure domain for recording (default: :bridge_runtime)
    - :component — calling module (default: Ema.Claude.Runner)
    - :stage — pipeline stage atom if applicable
  """
  @spec run(keyword()) :: result()
  def run(opts \\ []) do
    checks = %{
      binary: check_binary(opts),
      rate_limit: check_rate_limit(opts),
      token_budget: check_token_budget(opts)
    }

    first_failure =
      [:binary, :rate_limit, :token_budget]
      |> Enum.find_value(fn key ->
        case Map.get(checks, key) do
          {:fail, failure} -> failure
          :ok -> nil
        end
      end)

    %{
      ok: is_nil(first_failure),
      checks: checks,
      failure: first_failure
    }
  end

  @doc """
  Run preflight and return :ok or {:error, Failure.t()}.
  Records the failure if checks fail.
  """
  @spec run!(keyword()) :: :ok | {:error, Failure.t()}
  def run!(opts \\ []) do
    case run(opts) do
      %{ok: true} ->
        :ok

      %{failure: failure} ->
        Failure.record(failure)
        {:error, failure}
    end
  end

  # -------------------------------------------------------------------
  # Individual checks
  # -------------------------------------------------------------------

  defp check_binary(opts) do
    if Ema.Claude.Runner.available?() do
      :ok
    else
      failure =
        Failure.new(
          class: :cli_unavailable,
          code: :claude_binary_missing,
          domain: Keyword.get(opts, :domain, :bridge_runtime),
          component: Keyword.get(opts, :component, Ema.Claude.Runner),
          operation: :preflight,
          stage: Keyword.get(opts, :stage),
          retryable: false,
          raw_reason: "claude binary not found in PATH or ~/.local/bin/claude"
        )

      {:fail, failure}
    end
  end

  defp check_rate_limit(opts) do
    recent_failures = Failure.count_recent(:backend_unavailable, @rate_limit_window_seconds)
    timeout_failures = Failure.count_recent(:stage_timeout, @rate_limit_window_seconds)
    total = recent_failures + timeout_failures

    if total < @rate_limit_threshold do
      :ok
    else
      failure =
        Failure.new(
          class: :backend_unavailable,
          code: :rate_limited_by_failures,
          domain: Keyword.get(opts, :domain, :bridge_runtime),
          component: Keyword.get(opts, :component, Ema.Claude.Runner),
          operation: :preflight,
          stage: Keyword.get(opts, :stage),
          retryable: true,
          raw_reason: "#{total} failures in last #{@rate_limit_window_seconds}s (threshold: #{@rate_limit_threshold})",
          metadata: %{recent_failures: total, window_seconds: @rate_limit_window_seconds}
        )

      {:fail, failure}
    end
  end

  defp check_token_budget(opts) do
    prompt = Keyword.get(opts, :prompt)
    budget = Keyword.get(opts, :token_budget, @default_token_budget)

    if is_nil(prompt) do
      # No prompt provided — skip this check
      :ok
    else
      # Rough estimate: 1 token ~= 4 chars for English text
      estimated_tokens = div(byte_size(prompt), 4)

      if estimated_tokens <= budget do
        :ok
      else
        failure =
          Failure.new(
            class: :config_failure,
            code: :prompt_exceeds_token_budget,
            domain: Keyword.get(opts, :domain, :bridge_runtime),
            component: Keyword.get(opts, :component, Ema.Claude.Runner),
            operation: :preflight,
            stage: Keyword.get(opts, :stage),
            retryable: false,
            raw_reason: "Estimated #{estimated_tokens} tokens exceeds budget of #{budget}",
            metadata: %{estimated_tokens: estimated_tokens, budget: budget}
          )

        {:fail, failure}
      end
    end
  end
end
