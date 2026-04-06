defmodule Ema.Agents.SupervisorTest do
  use Ema.DataCase, async: false

  alias Ema.Agents

  setup do
    start_supervised!({Ema.Agents.Supervisor, []})
    :ok
  end

  test "start_active_agents starts workers for active agents" do
    {:ok, agent} =
      Agents.create_agent(%{
        slug: "supervisor-test-#{System.unique_integer([:positive])}",
        name: "Supervisor Test",
        model: "sonnet",
        status: "active",
        tools: []
      })

    assert [] == Registry.lookup(Ema.Agents.Registry, {:worker, agent.id})

    Ema.Agents.Supervisor.start_active_agents()

    assert [{pid, _}] = Registry.lookup(Ema.Agents.Registry, {:worker, agent.id})
    assert Process.alive?(pid)
  end
end
