import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { STATUS_COLORS } from "@/types/intents";

interface WikiPageRendererProps {
  readonly content: string;
  readonly onNavigate: (slug: string) => void;
}

export function WikiPageRenderer({ content, onNavigate }: WikiPageRendererProps) {
  // Strip frontmatter for rendering
  const body = content.replace(/^---[\s\S]*?---\n*/m, "");

  // Parse frontmatter for status badge
  const frontmatter = parseFrontmatter(content);

  return (
    <div className="h-full overflow-auto">
      {/* Intent status header */}
      {frontmatter.intent_level != null && (
        <div
          className="flex items-center gap-2 px-4 py-2 mb-3 rounded-lg"
          style={{
            background: "rgba(167, 139, 250, 0.06)",
            border: "1px solid rgba(167, 139, 250, 0.1)",
          }}
        >
          <StatusBadge status={String(frontmatter.intent_status ?? "planned")} />
          {frontmatter.intent_kind && (
            <span
              className="text-[0.65rem] px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "var(--pn-text-tertiary)",
              }}
            >
              {frontmatter.intent_kind}
            </span>
          )}
          {frontmatter.intent_priority != null && (
            <span
              className="text-[0.65rem]"
              style={{ color: "var(--pn-text-muted)" }}
            >
              P{frontmatter.intent_priority}
            </span>
          )}
        </div>
      )}

      {/* Rendered markdown */}
      <div className="wiki-content px-1">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1
                className="text-[1.3rem] font-bold mb-3 mt-1"
                style={{ color: "var(--pn-text-primary)" }}
              >
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2
                className="text-[1.05rem] font-semibold mb-2 mt-4"
                style={{
                  color: "var(--pn-text-primary)",
                  borderBottom: "1px solid var(--pn-border-subtle)",
                  paddingBottom: "0.25rem",
                }}
              >
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3
                className="text-[0.9rem] font-semibold mb-1.5 mt-3"
                style={{ color: "var(--pn-text-secondary)" }}
              >
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p
                className="text-[0.8rem] leading-relaxed mb-2"
                style={{ color: "var(--pn-text-secondary)" }}
              >
                {renderWikilinks(children, onNavigate)}
              </p>
            ),
            li: ({ children }) => (
              <li
                className="text-[0.8rem] leading-relaxed ml-4"
                style={{ color: "var(--pn-text-secondary)" }}
              >
                {renderWikilinks(children, onNavigate)}
              </li>
            ),
            ul: ({ children }) => <ul className="list-disc mb-2 space-y-0.5">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal mb-2 space-y-0.5">{children}</ol>,
            code: ({ children, className }) => {
              const isBlock = className?.includes("language-");
              if (isBlock) {
                return (
                  <code
                    className="block rounded-lg p-3 text-[0.75rem] overflow-x-auto mb-3 font-mono"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--pn-border-subtle)",
                      color: "var(--pn-text-secondary)",
                    }}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <code
                  className="px-1 py-0.5 rounded text-[0.75rem] font-mono"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: "#a78bfa",
                  }}
                >
                  {children}
                </code>
              );
            },
            pre: ({ children }) => <pre className="mb-3">{children}</pre>,
            table: ({ children }) => (
              <table
                className="w-full mb-3 text-[0.75rem]"
                style={{ borderCollapse: "collapse" }}
              >
                {children}
              </table>
            ),
            th: ({ children }) => (
              <th
                className="text-left px-2 py-1 font-semibold text-[0.7rem]"
                style={{
                  borderBottom: "1px solid var(--pn-border-default)",
                  color: "var(--pn-text-tertiary)",
                }}
              >
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td
                className="px-2 py-1 text-[0.75rem]"
                style={{
                  borderBottom: "1px solid var(--pn-border-subtle)",
                  color: "var(--pn-text-secondary)",
                }}
              >
                {children}
              </td>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className="underline"
                style={{ color: "#a78bfa" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            blockquote: ({ children }) => (
              <blockquote
                className="pl-3 mb-2"
                style={{
                  borderLeft: "2px solid rgba(167, 139, 250, 0.3)",
                  color: "var(--pn-text-tertiary)",
                }}
              >
                {children}
              </blockquote>
            ),
            hr: () => (
              <hr className="my-4" style={{ borderColor: "var(--pn-border-subtle)" }} />
            ),
            strong: ({ children }) => (
              <strong style={{ color: "var(--pn-text-primary)" }}>{children}</strong>
            ),
          }}
        >
          {body}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { readonly status: string }) {
  const color = STATUS_COLORS[status] ?? "#64748b";
  return (
    <span
      className="text-[0.65rem] px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${color}20`, color }}
    >
      {status}
    </span>
  );
}

function parseFrontmatter(content: string): Record<string, string | number | null> {
  const match = content.match(/^---\n([\s\S]*?)---/m);
  if (!match) return {};
  const fm: Record<string, string | number | null> = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^(\w[\w_-]*):\s*(.+)$/);
    if (m) {
      const val = m[2].trim().replace(/^"(.*)"$/, "$1");
      fm[m[1]] = /^\d+$/.test(val) ? parseInt(val) : val;
    }
  }
  return fm;
}

function renderWikilinks(
  children: React.ReactNode,
  onNavigate: (slug: string) => void
): React.ReactNode {
  if (typeof children === "string") {
    return processWikilinks(children, onNavigate);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === "string") {
        return <span key={i}>{processWikilinks(child, onNavigate)}</span>;
      }
      return child;
    });
  }
  return children;
}

function processWikilinks(
  text: string,
  onNavigate: (slug: string) => void
): React.ReactNode[] {
  const parts = text.split(/(\[\[[^\]]+\]\])/);
  return parts.map((part, i) => {
    const match = part.match(/\[\[(?:([^:]+)::)?([^\]|]+)(?:\|([^\]]+))?\]\]/);
    if (match) {
      const edgeType = match[1];
      const target = match[2];
      const label = match[3] ?? target;
      const slug = target
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return (
        <button
          key={i}
          type="button"
          onClick={() => onNavigate(slug)}
          className="inline-flex items-center gap-0.5 underline cursor-pointer"
          style={{ color: "#a78bfa" }}
        >
          {edgeType && (
            <span
              className="text-[0.55rem] px-1 rounded no-underline"
              style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}
            >
              {edgeType}
            </span>
          )}
          {label}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
