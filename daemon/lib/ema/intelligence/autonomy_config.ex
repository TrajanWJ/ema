defmodule Ema.Intelligence.AutonomyConfig do
  @moduledoc """
  ETS-backed autonomy level configuration per agent or global.

  Levels:
    :assist — every dispatch requires human approval (stub: always :ok for now)
    :auto   — execute within budget, post-hoc notify (default)
    :full   — execute, no notification

  Checked at dispatch time. ETS read path is <1us overhead.
  """

  use GenServer
  require Logger

  @table :ema_autonomy_config
  @valid_levels [:assist, :auto, :full]

  def start_link(opts \\ []), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  def init(_opts) do
    :ets.new(@table, [:named_table, :public, read_concurrency: true])
    :ets.insert(@table, {:global, :auto})
    {:ok, %{}}
  end

  @doc "Get autonomy level for an agent atom (falls back to :global)."
  def get_level(agent \\ :global) do
    case :ets.lookup(@table, agent) do
      [{^agent, level}] -> level
      [] ->
        if agent == :global, do: :auto, else: get_level(:global)
    end
  end

  @doc "Set autonomy level for :global or a specific agent atom."
  def set_level(target, level) when level in @valid_levels do
    GenServer.call(__MODULE__, {:set, target, level})
  end

  def set_level(_target, level), do: {:error, {:invalid_level, level, @valid_levels}}

  def handle_call({:set, target, level}, _from, state) do
    :ets.insert(@table, {target, level})
    Logger.info("[AutonomyConfig] #{target} -> #{level}")
    {:reply, :ok, state}
  end
end
