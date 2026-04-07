defmodule Ema.Claude.BridgeMock do
  @moduledoc """
  Deterministic mock for Claude API calls in tests.

  Returns fixture data based on prompt content, or a generic response
  for unmatched prompts. Avoids shelling out to the real Claude CLI.

  Usage in tests:

      Runner.run("generate a proposal", cmd_fn: &BridgeMock.cmd_fn/3)

  Or use `run/2` directly when testing higher-level code that accepts
  a runner function via dependency injection.
  """

  @doc """
  Mock replacement for `Runner.run/2`.

  Pattern-matches on prompt content to return appropriate fixture data.
  """
  def run(prompt, opts \\ []) do
    _model = Keyword.get(opts, :model, "sonnet")

    response =
      cond do
        String.contains?(prompt, "generator") ->
          load_fixture("generator_response.json")

        String.contains?(prompt, "refine") ->
          load_fixture("refiner_response.json")

        String.contains?(prompt, "debate") ->
          load_fixture("debater_response.json")

        String.contains?(prompt, "tag") ->
          load_fixture("tagger_response.json")

        true ->
          %{"result" => Jason.encode!(%{"response" => "mock response"})}
      end

    {:ok, response}
  end

  @doc """
  Drop-in replacement for `System.cmd/3` that can be passed as `:cmd_fn`
  to `Runner.run/2`. Returns valid JSON output with exit code 0.
  """
  def cmd_fn("bash", ["-c", shell_cmd], _opts) do
    prompt_file = extract_prompt_file(shell_cmd)

    prompt =
      case prompt_file && File.read(prompt_file) do
        {:ok, content} -> content
        _ -> shell_cmd
      end

    response =
      cond do
        String.contains?(prompt, "generator") ->
          load_fixture("generator_response.json")

        String.contains?(prompt, "refine") ->
          load_fixture("refiner_response.json")

        String.contains?(prompt, "debate") ->
          load_fixture("debater_response.json")

        String.contains?(prompt, "tag") ->
          load_fixture("tagger_response.json")

        true ->
          %{"response" => "mock response"}
      end

    {Jason.encode!(response), 0}
  end

  defp extract_prompt_file(shell_cmd) do
    case Regex.run(~r"< (.+)$", shell_cmd) do
      [_, path] -> String.trim(path)
      _ -> nil
    end
  end

  defp load_fixture(name) do
    path = Path.join([File.cwd!(), "test", "fixtures", "claude", name])

    case File.read(path) do
      {:ok, content} ->
        Jason.decode!(content)

      {:error, _} ->
        %{"result" => Jason.encode!(%{"response" => "fixture #{name} not found"})}
    end
  end
end
