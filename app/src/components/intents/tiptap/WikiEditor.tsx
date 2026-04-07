import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import { useEffect, useCallback } from "react";
import { CommentMark } from "./CommentMark";

interface WikiEditorProps {
  readonly content: string;
  readonly editable: boolean;
  readonly onUpdate?: (content: string) => void;
  readonly onNavigate?: (slug: string) => void;
  readonly onCommentAdd?: (commentId: string, text: string) => void;
}

export function WikiEditor({
  content,
  editable,
  onUpdate,
  onNavigate,
  onCommentAdd: _onCommentAdd,
}: WikiEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "wiki-link-external" },
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: { class: "wiki-highlight" },
      }),
      CommentMark,
    ],
    content: markdownToHtml(content),
    editable,
    onUpdate: ({ editor: e }) => {
      onUpdate?.(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: "wiki-editor-content",
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement;
        const wikilink = target.closest("[data-wiki-link]");
        if (wikilink && onNavigate) {
          const slug = wikilink.getAttribute("data-wiki-link") ?? "";
          onNavigate(slug);
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  useEffect(() => {
    if (editor) {
      const newContent = markdownToHtml(content);
      const currentContent = editor.getHTML();
      if (newContent !== currentContent) {
        editor.commands.setContent(newContent);
      }
    }
  }, [editor, content]);

  const handleAddComment = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const id = `cmt_${Date.now()}`;
    editor.chain().focus().setComment(id).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="wiki-editor-wrapper">
      {editable && (
        <div className="wiki-editor-toolbar">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            label="B"
            title="Bold"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            label="I"
            title="Italic"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive("code")}
            label="<>"
            title="Code"
          />
          <span className="wiki-toolbar-sep" />
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={editor.isActive("heading", { level: 2 })}
            label="H2"
            title="Heading 2"
          />
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            active={editor.isActive("heading", { level: 3 })}
            label="H3"
            title="Heading 3"
          />
          <span className="wiki-toolbar-sep" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            label="•"
            title="Bullet list"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            label="1."
            title="Numbered list"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            label="❝"
            title="Quote"
          />
          <span className="wiki-toolbar-sep" />
          <ToolbarButton
            onClick={handleAddComment}
            active={editor.isActive("comment")}
            label="💬"
            title="Add comment"
          />
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHighlight({ color: "#a78bfa40" }).run()
            }
            active={editor.isActive("highlight")}
            label="🖍"
            title="Highlight"
          />
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  label,
  title,
}: {
  readonly onClick: () => void;
  readonly active: boolean;
  readonly label: string;
  readonly title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="wiki-toolbar-btn"
      style={{
        background: active ? "rgba(167,139,250,0.15)" : "transparent",
        color: active ? "#a78bfa" : "var(--pn-text-tertiary)",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Lightweight markdown → HTML conversion for Tiptap.
 * Handles headings, bold, italic, code, lists, blockquotes, wikilinks, and links.
 * For full fidelity, swap to tiptap-markdown extension.
 */
function markdownToHtml(md: string): string {
  if (!md) return "<p></p>";

  // Strip YAML frontmatter
  let text = md.replace(/^---[\s\S]*?---\n*/m, "");

  // Convert wikilinks FIRST (before other link processing)
  text = text.replace(
    /\[\[(?:([^:]+)::)?([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_match, edgeType, target, label) => {
      const slug = target
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const display = label ?? target;
      const badge = edgeType
        ? `<span class="wiki-edge-badge">${edgeType}</span>`
        : "";
      return `${badge}<a data-wiki-link="${slug}" class="wiki-link" href="#${slug}">${display}</a>`;
    }
  );

  // Convert markdown to HTML line by line
  const lines = text.split("\n");
  const html: string[] = [];
  let inList: "ul" | "ol" | null = null;
  let inCodeBlock = false;

  for (const line of lines) {
    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        html.push("</code></pre>");
        inCodeBlock = false;
      } else {
        const lang = line.slice(3).trim();
        html.push(
          `<pre><code class="language-${lang || "text"}">`
        );
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      html.push(escapeHtml(line));
      continue;
    }

    // Close list if needed
    if (inList && !line.match(/^\s*[-*]\s/) && !line.match(/^\s*\d+\.\s/)) {
      html.push(inList === "ul" ? "</ul>" : "</ol>");
      inList = null;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Unordered list
    if (line.match(/^\s*[-*]\s/)) {
      if (inList !== "ul") {
        if (inList) html.push("</ol>");
        html.push("<ul>");
        inList = "ul";
      }
      html.push(`<li>${inlineFormat(line.replace(/^\s*[-*]\s/, ""))}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\s*\d+\.\s(.+)/);
    if (olMatch) {
      if (inList !== "ol") {
        if (inList) html.push("</ul>");
        html.push("<ol>");
        inList = "ol";
      }
      html.push(`<li>${inlineFormat(olMatch[1])}</li>`);
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      html.push(`<blockquote><p>${inlineFormat(line.slice(2))}</p></blockquote>`);
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      html.push("<hr>");
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      continue;
    }

    // Paragraph
    html.push(`<p>${inlineFormat(line)}</p>`);
  }

  if (inList) html.push(inList === "ul" ? "</ul>" : "</ol>");
  if (inCodeBlock) html.push("</code></pre>");

  return html.join("\n");
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="wiki-link-external" target="_blank" rel="noopener">$1</a>'
    );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
