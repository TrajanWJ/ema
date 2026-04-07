import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";

interface McpTool {
  readonly name: string;
  readonly description: string;
}

interface McpToolsResponse {
  readonly tools: McpTool[];
}

const CATEGORY_PREFIXES = [
  { prefix: "ema_workspace", label: "Workspace" },
  { prefix: "ema_intelligence", label: "Intelligence" },
  { prefix: "ema_session", label: "Sessions" },
  { prefix: "ema_", label: "EMA Core" },
] as const;

function categorize(tools: readonly McpTool[]): Map<string, McpTool[]> {
  const groups = new Map<string, McpTool[]>();
  const assigned = new Set<string>();

  for (const cat of CATEGORY_PREFIXES) {
    const matching = tools.filter(
      (t) => t.name.startsWith(cat.prefix) && !assigned.has(t.name),
    );
    if (matching.length > 0) {
      groups.set(cat.label, matching);
      for (const t of matching) assigned.add(t.name);
    }
  }

  const uncategorized = tools.filter((t) => !assigned.has(t.name));
  if (uncategorized.length > 0) {
    groups.set("Other", uncategorized);
  }

  return groups;
}

function ToolRow({ tool }: { readonly tool: McpTool }) {
  return (
    <div
      className="py-1.5 px-1"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
    >
      <div
        className="text-[0.7rem] font-mono font-medium"
        style={{ color: "var(--pn-text-primary)" }}
      >
        {tool.name}
      </div>
      {tool.description && (
        <div
          className="text-[0.6rem] mt-0.5 leading-relaxed"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          {tool.description}
        </div>
      )}
    </div>
  );
}

function McpToolsSection() {
  const [tools, setTools] = useState<readonly McpTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<McpToolsResponse>("/mcp/tools");
        if (!cancelled) {
          setTools(data.tools);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load tools",
          );
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p
        className="text-[0.75rem] py-4 text-center"
        style={{ color: "var(--pn-text-tertiary)" }}
      >
        Loading MCP tools...
      </p>
    );
  }

  if (error) {
    return (
      <p
        className="text-[0.75rem] py-4 text-center"
        style={{ color: "var(--color-pn-error)" }}
      >
        {error}
      </p>
    );
  }

  const groups = categorize(tools);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-[0.7rem] font-medium uppercase tracking-wider"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          MCP Tools
        </h3>
        <span
          className="text-[0.65rem] font-mono"
          style={{ color: "var(--pn-text-muted)" }}
        >
          {tools.length} tools
        </span>
      </div>

      {Array.from(groups.entries()).map(([category, groupTools]) => (
        <div key={category} className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[0.6rem] uppercase tracking-wider font-medium"
              style={{ color: "var(--pn-text-muted)" }}
            >
              {category}
            </span>
            <span
              className="text-[0.55rem]"
              style={{ color: "var(--pn-text-muted)" }}
            >
              ({groupTools.length})
            </span>
          </div>
          {groupTools.map((tool) => (
            <ToolRow key={tool.name} tool={tool} />
          ))}
        </div>
      ))}

      {tools.length === 0 && (
        <p
          className="text-[0.75rem] py-4 text-center"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          No MCP tools registered.
        </p>
      )}
    </>
  );
}

function CliDetectionSection() {
  const [cliTools, setCliTools] = useState<
    readonly { name: string; available: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<{
          tools: { name: string; available: boolean }[];
        }>("/mcp/cli-tools");
        if (!cancelled) {
          setCliTools(data.tools);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          // API may not exist yet, show fallback
          setCliTools([
            { name: "claude", available: false },
            { name: "codex", available: false },
            { name: "ollama", available: false },
          ]);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <h3
        className="text-[0.7rem] font-medium uppercase tracking-wider mb-3"
        style={{ color: "var(--pn-text-secondary)" }}
      >
        CLI Tools
      </h3>
      {loading ? (
        <p
          className="text-[0.75rem]"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Detecting...
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {cliTools.map((tool) => (
            <div key={tool.name} className="flex items-center gap-2 py-1">
              <div
                className="rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  background: tool.available
                    ? "var(--color-pn-success)"
                    : "rgba(255,255,255,0.1)",
                }}
              />
              <span
                className="text-[0.7rem] font-mono"
                style={{
                  color: tool.available
                    ? "var(--pn-text-primary)"
                    : "var(--pn-text-muted)",
                }}
              >
                {tool.name}
              </span>
              <span
                className="text-[0.6rem]"
                style={{ color: "var(--pn-text-muted)" }}
              >
                {tool.available ? "detected" : "not found"}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function DeveloperTab() {
  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h2
        className="text-[0.9rem] font-semibold"
        style={{ color: "var(--pn-text-primary)" }}
      >
        Developer
      </h2>

      <GlassCard>
        <McpToolsSection />
      </GlassCard>

      <GlassCard>
        <CliDetectionSection />
      </GlassCard>
    </div>
  );
}
