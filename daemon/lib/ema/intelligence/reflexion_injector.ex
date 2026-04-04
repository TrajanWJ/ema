defmodule Ema.Intelligence.ReflexionInjector do
  @moduledoc "Formats recent reflexion lessons into a prompt prefix."

  alias Ema.Intelligence.ReflexionStore

  def build_prefix(agent, domain, project_slug)
      when is_binary(agent) and is_binary(domain) and is_binary(project_slug) do
    case ReflexionStore.last_entries(agent, domain, project_slug, 3) do
      [] ->
        ""

      entries ->
        formatted_entries =
          entries
          |> Enum.reverse()
          |> Enum.map_join("\n", fn entry ->
            "- [#{entry.outcome_status}] #{entry.lesson}"
          end)

        """
        Past lessons:
        #{formatted_entries}

        Apply these lessons where relevant before taking new action.

        """
    end
  end

  def build_prefix(_, _, _), do: ""
end