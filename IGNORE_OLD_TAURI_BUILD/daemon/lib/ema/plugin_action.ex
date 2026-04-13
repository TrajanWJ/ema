defmodule Ema.PluginAction do
  @moduledoc """
  Behaviour that all plugin-contributed pipe actions must implement.

  ## Example

      defmodule MyPlugin.Actions.DoSomething do
        @behaviour Ema.PluginAction

        @impl true
        def execute(payload, config) do
          # payload: runtime pipe event payload (map)
          # config: static action config from pipe definition (map)
          {:ok, %{result: "done"}}
        end

        @impl true
        def schema do
          %{
            target: :string,
            amount: :integer
          }
        end
      end
  """

  @doc """
  Execute the plugin action.

  - `payload` — the runtime event payload from the pipe
  - `config` — static configuration from the pipe node definition

  Returns `{:ok, result}` on success, `{:error, reason}` on failure.
  """
  @callback execute(payload :: map(), config :: map()) :: {:ok, any()} | {:error, any()}

  @doc """
  Return the expected schema for this action's config.

  Used by the Pipes editor to show configuration fields.
  Keys are field names, values are types (`:string`, `:integer`, `:boolean`, etc.).
  """
  @callback schema() :: map()

  @optional_callbacks [schema: 0]
end
