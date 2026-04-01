# EMA Default Seeds
# Run with: mix run priv/repo/seeds.exs
#
# Idempotent — safe to run multiple times.

alias Ema.Repo
alias Ema.Projects.Project
alias Ema.Proposals.Seed
alias Ema.Responsibilities.Responsibility

require Logger

# ============================================================
# Helper: upsert by unique field
# ============================================================
defmodule Seeds.Helpers do
  def upsert_project(attrs) do
    case Repo.get_by(Project, slug: attrs.slug) do
      nil ->
        id = :crypto.strong_rand_bytes(6) |> Base.encode16(case: :lower)

        case Repo.insert(Project.changeset(%Project{}, Map.put(attrs, :id, id))) do
          {:ok, p} ->
            Logger.info("Created project: #{p.name}")
            p

          {:error, cs} ->
            Logger.warning("Failed to create project #{attrs.slug}: #{inspect(cs.errors)}")
            nil
        end

      existing ->
        Logger.info("Project already exists: #{existing.name}")
        existing
    end
  end

  def upsert_seed(attrs) do
    case Repo.get_by(Seed, name: attrs.name) do
      nil ->
        id = :crypto.strong_rand_bytes(6) |> Base.encode16(case: :lower)

        case Repo.insert(Seed.changeset(%Seed{}, Map.put(attrs, :id, id))) do
          {:ok, s} ->
            Logger.info("Created seed: #{s.name}")
            s

          {:error, cs} ->
            Logger.warning("Failed to create seed #{attrs.name}: #{inspect(cs.errors)}")
            nil
        end

      existing ->
        Logger.info("Seed already exists: #{existing.name}")
        existing
    end
  end

  def upsert_responsibility(attrs) do
    case Repo.get_by(Responsibility, title: attrs.title) do
      nil ->
        id = :crypto.strong_rand_bytes(6) |> Base.encode16(case: :lower)

        case Repo.insert(Responsibility.changeset(%Responsibility{}, Map.put(attrs, :id, id))) do
          {:ok, r} ->
            Logger.info("Created responsibility: #{r.title}")
            r

          {:error, cs} ->
            Logger.warning(
              "Failed to create responsibility #{attrs.title}: #{inspect(cs.errors)}"
            )

            nil
        end

      existing ->
        Logger.info("Responsibility already exists: #{existing.title}")
        existing
    end
  end
end

# ============================================================
# Task 2: Core Projects
# ============================================================
Logger.info("\n=== Seeding Projects ===")

ema_project =
  Seeds.Helpers.upsert_project(%{
    slug: "ema",
    name: "EMA",
    description:
      "Engineered Machine Assistant — personal operating system with autonomous thinking layer. Elixir daemon + React frontend running on the local machine.",
    status: "active",
    icon: "🧠",
    color: "#7C3AED",
    linked_path: Path.expand("~/Projects/ema"),
    settings: %{
      primary: true,
      repo: "local",
      stack: ["elixir", "phoenix", "react", "typescript"]
    }
  })

_claude_forge_project =
  Seeds.Helpers.upsert_project(%{
    slug: "claude-remote-discord",
    name: "ClaudeForge",
    description:
      "Claude Code remote control via Discord. Discord bot + web UI for managing Claude Code sessions remotely. Now superseded by EMA.",
    status: "paused",
    icon: "🔮",
    color: "#5865F2",
    linked_path: Path.expand("~/Desktop/Coding/Projects/claude-remote-discord"),
    settings: %{
      repo: "local",
      stack: ["typescript", "node", "discord.js", "next.js"]
    }
  })

_dispohub_project =
  Seeds.Helpers.upsert_project(%{
    slug: "dispohub",
    name: "DispoHub",
    description: "Disposable phone number management app.",
    status: "incubating",
    icon: "📱",
    color: "#059669",
    linked_path: Path.expand("~/Desktop/Coding/Projects/dispohub"),
    settings: %{repo: "local"}
  })

_execudeck_project =
  Seeds.Helpers.upsert_project(%{
    slug: "execudeck",
    name: "ExecuDeck",
    description: "Executive presentation deck tool.",
    status: "incubating",
    icon: "📊",
    color: "#D97706",
    linked_path: Path.expand("~/Desktop/Coding/Projects/execudeck"),
    settings: %{repo: "local"}
  })

# ============================================================
# Task 3: Proposal Engine Seeds
# ============================================================
Logger.info("\n=== Seeding Proposal Engine Seeds ===")

ema_project_id = if ema_project, do: ema_project.id, else: nil

Seeds.Helpers.upsert_seed(%{
  name: "Brainstorm improvements for EMA's UI/UX",
  prompt_template: """
  You are EMA's proposal engine. Review the current state of EMA's UI/UX.

  Look at:
  - Recent user interactions and pain points
  - The current component structure in the React app
  - Consistency of design patterns across screens

  Generate 3-5 concrete, actionable improvement proposals for EMA's UI/UX.
  Each proposal should include: what to change, why it matters, and estimated effort.
  """,
  seed_type: "cron",
  schedule: "0 */6 * * *",
  active: true,
  project_id: ema_project_id,
  context_injection: %{
    include_recent_sessions: true,
    include_vault_context: true,
    max_context_tokens: 4000
  },
  metadata: %{
    category: "product",
    priority: "high",
    tags: ["ui", "ux", "design", "ema"]
  }
})

Seeds.Helpers.upsert_seed(%{
  name: "Identify integration opportunities between EMA apps",
  prompt_template: """
  You are EMA's proposal engine. Review the apps and projects in EMA's ecosystem.

  Consider:
  - Data flows between different projects
  - APIs or events that could be shared
  - Workflows that cross project boundaries
  - Opportunities for EMA to become the hub connecting everything

  Generate 3-5 concrete integration proposals that would add real value.
  """,
  seed_type: "cron",
  schedule: "0 */12 * * *",
  active: true,
  project_id: nil,
  context_injection: %{
    include_all_projects: true,
    include_recent_proposals: true,
    max_context_tokens: 6000
  },
  metadata: %{
    category: "architecture",
    priority: "medium",
    tags: ["integration", "cross-project", "architecture"]
  }
})

Seeds.Helpers.upsert_seed(%{
  name: "Review code quality and suggest refactors",
  prompt_template: """
  You are EMA's code quality advisor. Review recent code changes and the overall
  codebase health for EMA.

  Focus on:
  - Patterns that could be simplified or extracted
  - Code that violates established conventions
  - Functions or modules that have grown too large
  - Missing tests for critical paths
  - Technical debt that should be addressed

  Generate 3-5 specific, actionable refactoring proposals with file references.
  """,
  seed_type: "cron",
  schedule: "0 9 * * *",
  active: true,
  project_id: ema_project_id,
  context_injection: %{
    include_recent_sessions: true,
    include_vault_context: false,
    max_context_tokens: 8000
  },
  metadata: %{
    category: "engineering",
    priority: "medium",
    tags: ["code-quality", "refactoring", "technical-debt"]
  }
})

Seeds.Helpers.upsert_seed(%{
  name: "What new virtual apps would be valuable?",
  prompt_template: """
  You are EMA's product visionary. Consider what new virtual apps could be
  added to EMA's ecosystem to increase Trajan's productivity and quality of life.

  Look at:
  - Repetitive tasks Trajan does manually
  - Gaps in current tooling
  - Patterns from recent work sessions
  - Opportunities to automate or augment workflows

  Generate 3-5 virtual app concepts with: name, purpose, core features, and integration points.
  """,
  seed_type: "cron",
  schedule: "0 */8 * * *",
  active: true,
  project_id: nil,
  context_injection: %{
    include_all_projects: true,
    include_recent_sessions: true,
    include_vault_context: true,
    max_context_tokens: 6000
  },
  metadata: %{
    category: "product",
    priority: "low",
    tags: ["virtual-apps", "features", "product-vision"]
  }
})

# ============================================================
# Task 4: Default Responsibilities
# ============================================================
Logger.info("\n=== Seeding Responsibilities ===")

Seeds.Helpers.upsert_responsibility(%{
  title: "Keep EMA tests passing",
  description:
    "Run the EMA test suite regularly. Fix any failing tests before merging new features. Maintain >90% coverage on critical paths.",
  role: "developer",
  cadence: "weekly",
  active: true,
  health: 1.0,
  project_id: ema_project_id,
  recurrence_rule: "FREQ=WEEKLY;BYDAY=MO",
  metadata: %{
    command: "cd ~/Projects/ema/daemon && mix test",
    tags: ["testing", "quality"]
  }
})

Seeds.Helpers.upsert_responsibility(%{
  title: "Review and merge PRs",
  description:
    "Check for open pull requests daily. Review code, leave comments, and merge when ready. Don't let PRs sit more than 24 hours.",
  role: "developer",
  cadence: "daily",
  active: true,
  health: 1.0,
  project_id: nil,
  recurrence_rule: "FREQ=DAILY",
  metadata: %{
    tags: ["code-review", "git", "collaboration"]
  }
})

Seeds.Helpers.upsert_responsibility(%{
  title: "Weekly review and planning",
  description:
    "Every week: review what was accomplished, identify blockers, plan next week's priorities. Update project statuses and archive completed work.",
  role: "self",
  cadence: "weekly",
  active: true,
  health: 1.0,
  project_id: nil,
  recurrence_rule: "FREQ=WEEKLY;BYDAY=SU",
  metadata: %{
    tags: ["planning", "review", "self-management"]
  }
})

Seeds.Helpers.upsert_responsibility(%{
  title: "Update dependencies",
  description:
    "Monthly dependency audit across all active projects. Update outdated packages, check for security advisories, test after updates.",
  role: "maintainer",
  cadence: "monthly",
  active: true,
  health: 1.0,
  project_id: nil,
  recurrence_rule: "FREQ=MONTHLY;BYMONTHDAY=1",
  metadata: %{
    tags: ["maintenance", "security", "dependencies"]
  }
})

Logger.info("\n=== Seeding Complete ===")
Logger.info("Run 'mix run priv/repo/seeds.exs' to re-run (idempotent)")
