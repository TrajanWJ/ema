# Domain agents seed — run with: mix run priv/repo/seeds/agents_seed.exs
alias Ema.Agents

agents = [
  %{
    slug: "strategist",
    name: "Strategist",
    description:
      "High-level planning, goal decomposition, tradeoff analysis, and strategic decision support.",
    avatar: "🎯",
    status: "active",
    model: "sonnet",
    temperature: 0.6,
    max_tokens: 4096,
    script_path: "priv/agent_prompts/strategist.md",
    tools: ["vault_read", "goal_context", "project_context"],
    settings: %{"domain" => "strategy", "priority" => "high"}
  },
  %{
    slug: "coach",
    name: "Coach",
    description:
      "Reflective practice partner. Reviews progress, surfaces blockers, helps reframe problems.",
    avatar: "🧭",
    status: "active",
    model: "sonnet",
    temperature: 0.8,
    max_tokens: 4096,
    script_path: "priv/agent_prompts/coach.md",
    tools: ["vault_read", "task_context", "session_memory"],
    settings: %{"domain" => "coaching", "priority" => "medium"}
  },
  %{
    slug: "archivist",
    name: "Archivist",
    description:
      "Knowledge extraction, vault writing, learnings synthesis, and memory consolidation.",
    avatar: "📚",
    status: "active",
    model: "haiku",
    temperature: 0.4,
    max_tokens: 4096,
    script_path: "priv/agent_prompts/archivist.md",
    tools: ["vault_read", "vault_write", "session_memory", "context_summary"],
    settings: %{"domain" => "knowledge", "priority" => "low"}
  }
]

Enum.each(agents, fn attrs ->
  case Agents.get_agent_by_slug(attrs.slug) do
    nil ->
      case Agents.create_agent(attrs) do
        {:ok, agent} -> IO.puts("Created agent: #{agent.name}")
        {:error, changeset} -> IO.puts("Failed to create #{attrs.name}: #{inspect(changeset.errors)}")
      end

    existing ->
      case Agents.update_agent(existing, attrs) do
        {:ok, agent} -> IO.puts("Updated agent: #{agent.name}")
        {:error, changeset} -> IO.puts("Failed to update #{attrs.name}: #{inspect(changeset.errors)}")
      end
  end
end)
