import { useState } from "react";
import { useJournalStore } from "@/stores/journal-store";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

type Mode = "edit" | "preview" | "split";

const MODE_OPTIONS = [
  { value: "edit" as const, label: "Edit" },
  { value: "preview" as const, label: "Preview" },
  { value: "split" as const, label: "Split" },
];

function renderMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.+)$/gm, '<h3 style="font-size:0.85rem;font-weight:600;margin:0.5em 0">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:0.9rem;font-weight:600;margin:0.5em 0">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:1rem;font-weight:700;margin:0.5em 0">$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li style="margin-left:1em;list-style:disc">$1</li>')
    // Line breaks
    .replace(/\n/g, "<br />");
}

function MarkdownPreview({ content }: { readonly content: string }) {
  return (
    <div
      className="text-[0.8rem] leading-relaxed overflow-auto h-full"
      style={{ color: "var(--pn-text-primary)" }}
      // Using dangerouslySetInnerHTML for simple markdown preview
      // Content comes from the user's own journal entry
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}

export function JournalEditor() {
  const [mode, setMode] = useState<Mode>("edit");
  const currentEntry = useJournalStore((s) => s.currentEntry);
  const updateField = useJournalStore((s) => s.updateField);
  const loading = useJournalStore((s) => s.loading);

  const content = currentEntry?.content ?? "";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          Journal
        </span>
        <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={setMode} />
      </div>

      <div className="flex-1 min-h-0 flex gap-2">
        {(mode === "edit" || mode === "split") && (
          <textarea
            value={content}
            onChange={(e) => updateField("content", e.target.value)}
            disabled={loading}
            placeholder="Write something..."
            className="flex-1 resize-none rounded-lg p-3 text-[0.8rem] outline-none disabled:opacity-40"
            style={{
              fontFamily: "ui-monospace, monospace",
              color: "var(--pn-text-primary)",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
        )}
        {(mode === "preview" || mode === "split") && (
          <div
            className="flex-1 rounded-lg p-3 overflow-auto"
            style={{ border: "1px solid rgba(255,255,255,0.04)" }}
          >
            <MarkdownPreview content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
