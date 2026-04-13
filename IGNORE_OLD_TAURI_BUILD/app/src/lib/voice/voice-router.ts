import { api } from "@/lib/api";

type RouteResult = {
  response: string;
  type: "command" | "conversation";
};

type AgentSummary = {
  id: string;
  name: string;
  slug: string;
  status?: string;
};

type DashboardToday = {
  tasks_due?: number;
  habits_due?: number;
  brain_dump_count?: number;
  active_agents?: number;
  summary?: string;
};

type VaultSearchResult = {
  results?: Array<{ title?: string; file_path?: string }>;
};

type BrainDumpResponse = {
  id?: string;
};

type TaskResponse = {
  id?: string;
  title?: string;
};

type VoiceProcessResponse = {
  reply?: string;
};

const APP_NAMES = [
  "brain dump",
  "habits",
  "journal",
  "tasks",
  "projects",
  "proposals",
  "responsibilities",
  "agents",
  "vault",
  "canvas",
  "pipes",
  "channels",
  "settings",
] as const;

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function extractAfter(text: string, ...prefixes: string[]): string | null {
  const lower = normalize(text);
  for (const prefix of prefixes) {
    if (lower.startsWith(prefix)) {
      const rest = text.slice(prefix.length).trim();
      if (rest.length > 0) return rest;
    }
  }
  return null;
}

function matchesAny(text: string, patterns: string[]): boolean {
  const lower = normalize(text);
  return patterns.some((p) => lower.includes(p));
}

async function handleStatus(): Promise<RouteResult> {
  try {
    const agents = await api.get<AgentSummary[]>("/agents");
    if (!agents || agents.length === 0) {
      return { response: "No agents are currently configured.", type: "command" };
    }

    const summaries = agents
      .map((a) => `${a.name}: ${a.status ?? "unknown"}`)
      .join(", ");

    return {
      response: `You have ${agents.length} agent${agents.length === 1 ? "" : "s"}. ${summaries}.`,
      type: "command",
    };
  } catch {
    return { response: "Sorry, I couldn't fetch agent status right now.", type: "command" };
  }
}

async function handleStandup(): Promise<RouteResult> {
  try {
    const dashboard = await api.get<DashboardToday>("/dashboard/today");

    const parts: string[] = [];
    if (dashboard.summary) {
      parts.push(dashboard.summary);
    } else {
      if (dashboard.tasks_due != null) {
        parts.push(`${dashboard.tasks_due} task${dashboard.tasks_due === 1 ? "" : "s"} due`);
      }
      if (dashboard.habits_due != null) {
        parts.push(`${dashboard.habits_due} habit${dashboard.habits_due === 1 ? "" : "s"} to complete`);
      }
      if (dashboard.brain_dump_count != null && dashboard.brain_dump_count > 0) {
        parts.push(`${dashboard.brain_dump_count} item${dashboard.brain_dump_count === 1 ? "" : "s"} in your brain dump`);
      }
    }

    if (parts.length === 0) {
      return { response: "Your dashboard looks clear. Nothing urgent.", type: "command" };
    }

    return { response: `Here's your briefing: ${parts.join(". ")}.`, type: "command" };
  } catch {
    return { response: "Sorry, I couldn't pull up your briefing right now.", type: "command" };
  }
}

async function handleSearch(query: string): Promise<RouteResult> {
  try {
    const encoded = encodeURIComponent(query);
    const data = await api.get<VaultSearchResult>(`/vault/search?q=${encoded}`);
    const results = data.results ?? [];

    if (results.length === 0) {
      return { response: `No results found for "${query}".`, type: "command" };
    }

    const titles = results
      .slice(0, 5)
      .map((r) => r.title ?? r.file_path ?? "untitled")
      .join(", ");

    return {
      response: `Found ${results.length} result${results.length === 1 ? "" : "s"}. Top matches: ${titles}.`,
      type: "command",
    };
  } catch {
    return { response: `Sorry, the search for "${query}" failed.`, type: "command" };
  }
}

async function handleBrainDump(content: string): Promise<RouteResult> {
  try {
    await api.post<BrainDumpResponse>("/brain-dump/items", { content });
    return { response: `Got it. Captured to your brain dump: "${content}".`, type: "command" };
  } catch {
    return { response: "Sorry, I couldn't save that to your brain dump.", type: "command" };
  }
}

async function handleTask(content: string): Promise<RouteResult> {
  try {
    const task = await api.post<TaskResponse>("/tasks", {
      title: content,
      status: "todo",
    });
    const title = task.title ?? content;
    return { response: `Task created: "${title}".`, type: "command" };
  } catch {
    return { response: "Sorry, I couldn't create that task.", type: "command" };
  }
}

function handleOpen(appName: string): RouteResult {
  const lower = appName.toLowerCase().trim();
  const match = APP_NAMES.find((name) => lower.includes(name));

  if (match) {
    return {
      response: `Opening ${match}.`,
      type: "command",
    };
  }

  return {
    response: `I don't recognize an app called "${appName}". Available apps: ${APP_NAMES.join(", ")}.`,
    type: "command",
  };
}

async function handleFallback(text: string): Promise<RouteResult> {
  try {
    const data = await api.post<VoiceProcessResponse>("/voice/process", { text });
    return {
      response: data.reply ?? "I heard you, but I'm not sure how to help with that.",
      type: "conversation",
    };
  } catch {
    return {
      response: "Sorry, I couldn't process that right now.",
      type: "conversation",
    };
  }
}

export async function routeCommand(text: string): Promise<RouteResult> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { response: "I didn't catch anything.", type: "conversation" };
  }

  // Status check
  if (matchesAny(trimmed, ["status", "what's running", "whats running"])) {
    return handleStatus();
  }

  // Standup / briefing
  if (matchesAny(trimmed, ["standup", "morning briefing", "what's happening", "whats happening"])) {
    return handleStandup();
  }

  // Search
  const searchQuery = extractAfter(trimmed, "search ");
  if (searchQuery) {
    return handleSearch(searchQuery);
  }

  // Brain dump / capture / note
  const noteContent =
    extractAfter(trimmed, "note ", "capture ", "brain dump ") ;
  if (noteContent) {
    return handleBrainDump(noteContent);
  }

  // Task creation
  const taskContent = extractAfter(trimmed, "create task ", "task ");
  if (taskContent) {
    return handleTask(taskContent);
  }

  // Open app
  const openTarget = extractAfter(trimmed, "open ");
  if (openTarget) {
    return handleOpen(openTarget);
  }

  // Fallback — send to agent
  return handleFallback(trimmed);
}
