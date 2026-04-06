defmodule Ema.Agents.OpenClawSync do
  @moduledoc """
  Seeds EMA agent records for each OpenClaw agent.
  Idempotent — skips agents that already exist by slug.
  """

  require Logger

  alias Ema.Agents

  @openclaw_agents [
    %{
      slug: "right-hand",
      name: "Right Hand",
      description: "Primary assistant — handles everything, delegates to specialists",
      avatar: "🦞",
      accent_color: "#2dd4a8",
      openclaw_agent_id: "main",
      model: "sonnet"
    },
    %{
      slug: "researcher",
      name: "Researcher",
      description: "Deep research, analysis, and information synthesis",
      avatar: "🔬",
      accent_color: "#a78bfa",
      openclaw_agent_id: "researcher",
      model: "sonnet"
    },
    %{
      slug: "coder",
      name: "Coder",
      description: "Code generation, debugging, and software architecture",
      avatar: "💻",
      accent_color: "#57A773",
      openclaw_agent_id: "coder",
      model: "sonnet"
    },
    %{
      slug: "ops",
      name: "Ops",
      description: "Infrastructure, deployment, and system operations",
      avatar: "⚙️",
      accent_color: "#f59e0b",
      openclaw_agent_id: "ops",
      model: "sonnet"
    },
    %{
      slug: "security",
      name: "Security",
      description: "Security analysis, threat modeling, and vulnerability assessment",
      avatar: "🛡️",
      accent_color: "#ef4444",
      openclaw_agent_id: "security",
      model: "sonnet"
    },
    %{
      slug: "vault-keeper",
      name: "Vault Keeper",
      description: "Knowledge management, note organization, and vault maintenance",
      avatar: "📚",
      accent_color: "#8b5cf6",
      openclaw_agent_id: "vault-keeper",
      model: "sonnet"
    },
    %{
      slug: "browser-automation",
      name: "Browser Automation",
      description: "Web scraping, browser tasks, and automated workflows",
      avatar: "🌐",
      accent_color: "#06b6d4",
      openclaw_agent_id: "browser-automation",
      model: "sonnet"
    },
    %{
      slug: "prompt-engineer",
      name: "Prompt Engineer",
      description: "Prompt design, optimization, and AI interaction patterns",
      avatar: "✨",
      accent_color: "#ec4899",
      openclaw_agent_id: "prompt-engineer",
      model: "sonnet"
    },
    %{
      slug: "concierge",
      name: "Concierge",
      description: "Scheduling, reminders, and personal coordination",
      avatar: "🎩",
      accent_color: "#14b8a6",
      openclaw_agent_id: "concierge",
      model: "sonnet"
    },
    %{
      slug: "devils-advocate",
      name: "Devil's Advocate",
      description: "Critical analysis, challenge assumptions, find blind spots",
      avatar: "😈",
      accent_color: "#f97316",
      openclaw_agent_id: "devils-advocate",
      model: "sonnet"
    },
    %{
      slug: "strategist",
      name: "Strategist",
      description: "Strategic planning, decision frameworks, and long-term thinking",
      avatar: "♟️",
      accent_color: "#3b82f6",
      openclaw_agent_id: "strategist",
      model: "sonnet"
    }
  ]

  @doc """
  Seed agent records for all OpenClaw agents.
  Idempotent — existing agents (by slug) are skipped.
  Returns a list of `{:created | :exists, slug}` tuples.
  """
  def seed_agents do
    Logger.info("Seeding OpenClaw agents...")

    results =
      Enum.map(@openclaw_agents, fn agent_def ->
        case Agents.get_agent_by_slug(agent_def.slug) do
          nil ->
            attrs = %{
              slug: agent_def.slug,
              name: agent_def.name,
              description: agent_def.description,
              avatar: agent_def.avatar,
              status: "active",
              model: agent_def.model,
              temperature: 0.7,
              max_tokens: 8192,
              settings: %{
                "backend" => "openclaw",
                "openclaw_agent_id" => agent_def.openclaw_agent_id,
                "accent_color" => agent_def.accent_color,
                "auto_respond_channels" => ["webchat"]
              }
            }

            case Agents.create_agent(attrs) do
              {:ok, agent} ->
                Logger.info("Created OpenClaw agent: #{agent.slug}")
                {:created, agent.slug}

              {:error, changeset} ->
                Logger.warning(
                  "Failed to create agent #{agent_def.slug}: #{inspect(changeset.errors)}"
                )

                {:error, agent_def.slug}
            end

          _existing ->
            {:exists, agent_def.slug}
        end
      end)

    created = Enum.count(results, fn {status, _} -> status == :created end)
    existing = Enum.count(results, fn {status, _} -> status == :exists end)
    Logger.info("OpenClaw sync complete: #{created} created, #{existing} already existed")

    results
  end

  @doc "Start all seeded OpenClaw agents that aren't already running."
  def start_agents do
    Agents.list_active_agents()
    |> Enum.filter(fn agent ->
      settings = agent.settings || %{}
      Map.get(settings, "backend") == "openclaw"
    end)
    |> Enum.each(fn agent ->
      Ema.Agents.Supervisor.start_agent(agent.id)
    end)
  end

  @doc "Seed and start all OpenClaw agents."
  def sync do
    seed_agents()
    start_agents()
  end
end
