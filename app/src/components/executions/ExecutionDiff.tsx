import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface DiffStats {
  execution_id: string;
  git_diff: string | null;
  files_changed: number;
  lines_added: number;
  lines_removed: number;
}

interface ParsedFile {
  filename: string;
  hunks: ParsedHunk[];
  linesAdded: number;
  linesRemoved: number;
}

interface ParsedHunk {
  header: string;
  lines: ParsedLine[];
}

interface ParsedLine {
  type: "added" | "removed" | "context";
  content: string;
}

function parseDiff(diff: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  let currentFile: ParsedFile | null = null;
  let currentHunk: ParsedHunk | null = null;

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git")) {
      if (currentFile) {
        if (currentHunk) currentFile.hunks.push(currentHunk);
        files.push(currentFile);
      }
      const match = line.match(/diff --git a\/(.*) b\/(.*)/);
      const filename = match ? match[2] : line.replace("diff --git ", "");
      currentFile = { filename, hunks: [], linesAdded: 0, linesRemoved: 0 };
      currentHunk = null;
    } else if (line.startsWith("@@") && currentFile) {
      if (currentHunk) currentFile.hunks.push(currentHunk);
      currentHunk = { header: line, lines: [] };
    } else if (currentFile && currentHunk) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        currentHunk.lines.push({ type: "added", content: line.slice(1) });
        currentFile.linesAdded++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        currentHunk.lines.push({ type: "removed", content: line.slice(1) });
        currentFile.linesRemoved++;
      } else if (
        !line.startsWith("---") &&
        !line.startsWith("+++") &&
        !line.startsWith("index ") &&
        !line.startsWith("new file") &&
        !line.startsWith("deleted file") &&
        !line.startsWith("Binary")
      ) {
        currentHunk.lines.push({
          type: "context",
          content: line.startsWith(" ") ? line.slice(1) : line,
        });
      }
    }
  }

  if (currentFile) {
    if (currentHunk) currentFile.hunks.push(currentHunk);
    files.push(currentFile);
  }

  return files;
}

function DiffFile({ file }: { readonly file: ParsedFile }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        marginBottom: 8,
      }}
    >
      {/* File header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          background: "rgba(255,255,255,0.04)",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "monospace",
          }}
        >
          {collapsed ? "▶" : "▼"}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 12,
            fontFamily: "JetBrains Mono, monospace",
            color: "rgba(255,255,255,0.87)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {file.filename}
        </span>
        {file.linesAdded > 0 && (
          <span
            style={{
              fontSize: 11,
              color: "#4ade80",
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            +{file.linesAdded}
          </span>
        )}
        {file.linesRemoved > 0 && (
          <span
            style={{
              fontSize: 11,
              color: "#f87171",
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            -{file.linesRemoved}
          </span>
        )}
      </button>

      {/* Hunks */}
      {!collapsed && (
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11,
            overflowX: "auto",
          }}
        >
          {file.hunks.map((hunk, hi) => (
            <div key={hi}>
              <div
                style={{
                  padding: "4px 12px",
                  background: "rgba(99,102,241,0.1)",
                  color: "#818cf8",
                  borderTop: "1px solid rgba(99,102,241,0.15)",
                }}
              >
                {hunk.header}
              </div>
              {hunk.lines.map((line, li) => (
                <div
                  key={li}
                  style={{
                    padding: "1px 12px",
                    whiteSpace: "pre",
                    lineHeight: 1.7,
                    background:
                      line.type === "added"
                        ? "rgba(74,222,128,0.08)"
                        : line.type === "removed"
                          ? "rgba(248,113,113,0.08)"
                          : "transparent",
                    color:
                      line.type === "added"
                        ? "#4ade80"
                        : line.type === "removed"
                          ? "#f87171"
                          : "rgba(255,255,255,0.6)",
                    borderLeft:
                      line.type === "added"
                        ? "2px solid rgba(74,222,128,0.4)"
                        : line.type === "removed"
                          ? "2px solid rgba(248,113,113,0.4)"
                          : "2px solid transparent",
                  }}
                >
                  {line.type === "added"
                    ? "+"
                    : line.type === "removed"
                      ? "-"
                      : " "}
                  {line.content}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExecutionDiff({
  executionId,
}: {
  readonly executionId: string;
}) {
  const [stats, setStats] = useState<DiffStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get<DiffStats>(`/executions/${executionId}/diff`)
      .then((data) => {
        setStats(data);
      })
      .catch(() => {
        setError("Failed to load diff");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [executionId]);

  const handleCopy = useCallback(async () => {
    if (!stats?.git_diff) return;
    await navigator.clipboard.writeText(stats.git_diff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [stats]);

  if (loading) {
    return (
      <div
        style={{
          padding: 20,
          textAlign: "center",
          color: "rgba(255,255,255,0.4)",
          fontSize: 12,
        }}
      >
        Loading diff...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 12,
          color: "#f87171",
          fontSize: 12,
          borderRadius: 6,
          background: "rgba(248,113,113,0.1)",
        }}
      >
        {error}
      </div>
    );
  }

  if (!stats || !stats.git_diff) {
    return (
      <div
        style={{
          padding: 20,
          textAlign: "center",
          color: "rgba(255,255,255,0.25)",
          fontSize: 12,
          fontStyle: "italic",
        }}
      >
        No git diff available for this execution.
      </div>
    );
  }

  const parsedFiles = parseDiff(stats.git_diff);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Stats bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 12px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
          {stats.files_changed} file{stats.files_changed !== 1 ? "s" : ""}{" "}
          changed
        </span>
        <span style={{ fontSize: 11, color: "#4ade80" }}>
          +{stats.lines_added}
        </span>
        <span style={{ fontSize: 11, color: "#f87171" }}>
          -{stats.lines_removed}
        </span>
        <button
          onClick={handleCopy}
          style={{
            marginLeft: "auto",
            fontSize: 11,
            padding: "3px 10px",
            borderRadius: 6,
            background: copied
              ? "rgba(74,222,128,0.15)"
              : "rgba(255,255,255,0.06)",
            color: copied ? "#4ade80" : "rgba(255,255,255,0.5)",
            border: "1px solid rgba(255,255,255,0.08)",
            cursor: "pointer",
          }}
        >
          {copied ? "✓ Copied" : "Copy diff"}
        </button>
      </div>

      {/* Files */}
      <div>
        {parsedFiles.map((file, i) => (
          <DiffFile key={i} file={file} />
        ))}
      </div>
    </div>
  );
}
