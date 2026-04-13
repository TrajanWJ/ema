import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useChannelsStore } from "@/stores/channels-store";
import type { Member } from "@/stores/channels-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ROWS = 6;
const LINE_HEIGHT_PX = 20;
const MAX_HEIGHT_PX = MAX_ROWS * LINE_HEIGHT_PX;
const MAX_CHARS = 2000;

const SLASH_COMMANDS = [
  { cmd: "/task", desc: "Create a task from this message" },
  { cmd: "/braindump", desc: "Send to brain dump inbox" },
  { cmd: "/summarize", desc: "Summarize the conversation" },
  { cmd: "/propose", desc: "Create a proposal seed" },
  { cmd: "/focus", desc: "Start a focus session" },
  { cmd: "/clear", desc: "Clear chat messages" },
  { cmd: "/dm", desc: "Start a direct message" },
  { cmd: "/status", desc: "Show agent statuses" },
  { cmd: "/help", desc: "Show available commands" },
  { cmd: "/agents", desc: "List active agents" },
] as const;

const COMMON_EMOJIS = [
  "\u{1F44D}", "\u{1F44E}", "\u2764\uFE0F", "\u{1F525}", "\u{1F389}", "\u{1F602}", "\u{1F914}", "\u{1F440}",
  "\u2705", "\u274C", "\u26A1", "\u{1F680}", "\u{1F4A1}", "\u{1F4DD}", "\u{1F41B}", "\u{1F3AF}",
  "\u{1F4AC}", "\u{1F4CC}", "\u{1F514}", "\u23F3", "\u{1F9EA}", "\u{1F6E0}\uFE0F", "\u{1F4CA}", "\u{1F3C1}",
] as const;

// ---------------------------------------------------------------------------
// Dropdown style helpers — glass elevated panel
// ---------------------------------------------------------------------------

const DROPDOWN_PANEL: React.CSSProperties = {
  position: "absolute",
  bottom: "100%",
  left: 0,
  right: 0,
  marginBottom: "4px",
  background: "rgba(14,16,23,0.92)",
  backdropFilter: "blur(20px)",
  border: "1px solid var(--pn-border-default)",
  borderRadius: "8px",
  maxHeight: "220px",
  overflowY: "auto",
  zIndex: 20,
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SlashCommandMenu({
  filter,
  activeIndex,
  onSelect,
}: {
  filter: string;
  activeIndex: number;
  onSelect: (cmd: string) => void;
}) {
  const filtered = useMemo(
    () => SLASH_COMMANDS.filter((c) => c.cmd.includes(filter.toLowerCase())),
    [filter],
  );

  if (filtered.length === 0) return null;

  return (
    <div style={DROPDOWN_PANEL}>
      <div
        className="px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--pn-text-muted)" }}
      >
        Commands
      </div>
      {filtered.map((c, i) => (
        <button
          key={c.cmd}
          onMouseDown={(e) => {
            e.preventDefault(); // keep textarea focused
            onSelect(c.cmd);
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
          style={{
            background: i === activeIndex ? "rgba(88,101,242,0.15)" : "transparent",
            color: "var(--pn-text-primary)",
            border: "none",
            cursor: "pointer",
          }}
        >
          <span className="text-[0.75rem] font-mono font-semibold shrink-0" style={{ color: "#5865F2" }}>
            {c.cmd}
          </span>
          <span className="text-[0.7rem] truncate" style={{ color: "var(--pn-text-tertiary)" }}>
            {c.desc}
          </span>
        </button>
      ))}
    </div>
  );
}

function MentionMenu({
  filter,
  members,
  activeIndex,
  onSelect,
}: {
  filter: string;
  members: Member[];
  activeIndex: number;
  onSelect: (name: string) => void;
}) {
  const filtered = useMemo(
    () => members.filter((m) => m.name.toLowerCase().includes(filter.toLowerCase())),
    [filter, members],
  );

  if (filtered.length === 0) return null;

  return (
    <div style={DROPDOWN_PANEL}>
      <div
        className="px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--pn-text-muted)" }}
      >
        Members
      </div>
      {filtered.map((m, i) => (
        <button
          key={m.id}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(m.name);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
          style={{
            background: i === activeIndex ? "rgba(88,101,242,0.15)" : "transparent",
            color: "var(--pn-text-primary)",
            border: "none",
            cursor: "pointer",
          }}
        >
          {/* Mini avatar */}
          <div
            className="flex items-center justify-center rounded-full text-[0.55rem] font-bold shrink-0"
            style={{
              width: "22px",
              height: "22px",
              background: m.accent ? `${m.accent}20` : "rgba(255,255,255,0.06)",
              border: `1px solid ${m.accent ? `${m.accent}33` : "rgba(255,255,255,0.08)"}`,
              color: m.accent ?? "var(--pn-text-tertiary)",
            }}
          >
            {m.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-[0.75rem] font-medium">{m.name}</span>
          {m.role && (
            <span className="text-[0.6rem] ml-auto" style={{ color: "var(--pn-text-muted)" }}>
              {m.role}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="rounded-lg p-2"
      style={{
        position: "absolute",
        bottom: "100%",
        right: 0,
        marginBottom: "4px",
        width: "228px",
        background: "rgba(14,16,23,0.92)",
        backdropFilter: "blur(20px)",
        border: "1px solid var(--pn-border-default)",
        borderRadius: "8px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        zIndex: 20,
      }}
    >
      <div
        className="text-[0.6rem] font-semibold uppercase tracking-wider px-1 pb-1.5"
        style={{ color: "var(--pn-text-muted)" }}
      >
        Emoji
      </div>
      <div className="grid grid-cols-8 gap-0.5">
        {COMMON_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(emoji);
            }}
            className="flex items-center justify-center rounded p-1 text-base transition-colors"
            style={{ border: "none", background: "transparent", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function TypingIndicator({ members }: { members: Member[] }) {
  if (members.length === 0) return null;

  const names = members.map((m) => m.name);
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <div className="flex items-center gap-1.5 px-1 h-5 text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
      <span className="inline-flex gap-0.5">
        {[0, 0.2, 0.4].map((delay) => (
          <span key={delay} style={{ animation: `inputBounce 1.4s infinite ${delay}s` }}>&bull;</span>
        ))}
      </span>
      <span>{label}</span>
      <style>{`@keyframes inputBounce { 0%,60%,100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-3px); opacity: 1; } }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Menu state type
// ---------------------------------------------------------------------------

type MenuKind = "slash" | "mention" | null;

// ---------------------------------------------------------------------------
// InputBar
// ---------------------------------------------------------------------------

export function InputBar({
  onSend,
  disabled,
  placeholder,
}: {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [menuKind, setMenuKind] = useState<MenuKind>(null);
  const [menuFilter, setMenuFilter] = useState("");
  const [menuIndex, setMenuIndex] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const members = useChannelsStore((s) => s.members);
  const typingMembers = useChannelsStore((s) => s.typingMembers());
  const sendTypingIndicator = useChannelsStore((s) => s.sendTypingIndicator);

  // ---- Auto-resize textarea ----

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [text, resize]);

  // ---- Computed: filtered item counts for keyboard nav bounds ----

  const filteredSlashCommands = useMemo(
    () => SLASH_COMMANDS.filter((c) => c.cmd.includes(menuFilter.toLowerCase())),
    [menuFilter],
  );

  const filteredMembers = useMemo(
    () => members.filter((m) => m.name.toLowerCase().includes(menuFilter.toLowerCase())),
    [menuFilter, members],
  );

  const menuItemCount =
    menuKind === "slash" ? filteredSlashCommands.length
      : menuKind === "mention" ? filteredMembers.length
        : 0;

  // ---- Close all menus ----

  const closeMenu = useCallback(() => {
    setMenuKind(null);
    setMenuFilter("");
    setMenuIndex(0);
  }, []);

  // ---- Send ----

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    closeMenu();
    setShowEmoji(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [text, disabled, onSend, closeMenu]);

  // ---- Selection handlers ----

  const handleSlashSelect = useCallback(
    (cmd: string) => {
      setText(cmd + " ");
      closeMenu();
      textareaRef.current?.focus();
    },
    [closeMenu],
  );

  const handleMentionSelect = useCallback(
    (name: string) => {
      const cursorPos = textareaRef.current?.selectionStart ?? text.length;
      const beforeCursor = text.slice(0, cursorPos);
      const atIndex = beforeCursor.lastIndexOf("@");
      if (atIndex === -1) return;
      const after = text.slice(cursorPos);
      setText(`${text.slice(0, atIndex)}@${name} ${after}`);
      closeMenu();
      textareaRef.current?.focus();
    },
    [text, closeMenu],
  );

  const handleEmojiSelect = useCallback((emoji: string) => {
    setText((prev) => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  }, []);

  // ---- Input change with menu detection ----

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setText(value);

      // Debounced typing indicator
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => sendTypingIndicator(), 300);

      const cursorPos = e.target.selectionStart;
      const beforeCursor = value.slice(0, cursorPos);

      // Slash: "/" at the very start of input
      if (beforeCursor === "/" || /^\/\S*$/.test(beforeCursor)) {
        setMenuKind("slash");
        setMenuFilter(beforeCursor);
        setMenuIndex(0);
        return;
      }

      // @mention: "@" preceded by whitespace or start, followed by optional word chars
      const mentionMatch = beforeCursor.match(/(^|[\s])@(\w*)$/);
      if (mentionMatch) {
        setMenuKind("mention");
        setMenuFilter(mentionMatch[2]);
        setMenuIndex(0);
        return;
      }

      if (menuKind !== null) closeMenu();
    },
    [menuKind, sendTypingIndicator, closeMenu],
  );

  // ---- Keyboard ----

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Navigate open menu
      if (menuKind !== null && menuItemCount > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMenuIndex((prev) => (prev + 1) % menuItemCount);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMenuIndex((prev) => (prev - 1 + menuItemCount) % menuItemCount);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          if (menuKind === "slash" && filteredSlashCommands[menuIndex]) {
            handleSlashSelect(filteredSlashCommands[menuIndex].cmd);
          } else if (menuKind === "mention" && filteredMembers[menuIndex]) {
            handleMentionSelect(filteredMembers[menuIndex].name);
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeMenu();
          return;
        }
      }

      // Close emoji picker on Escape
      if (e.key === "Escape" && showEmoji) {
        setShowEmoji(false);
        return;
      }

      // Send on Enter (Shift+Enter inserts newline naturally)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [
      menuKind, menuItemCount, menuIndex, showEmoji,
      filteredSlashCommands, filteredMembers,
      handleSend, handleSlashSelect, handleMentionSelect, closeMenu,
    ],
  );

  // ---- Drag and drop ----

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Insert file names as placeholder references (real upload would go through the store)
    const names = files.map((f) => `[${f.name}]`).join(" ");
    setText((prev) => (prev ? `${prev} ${names}` : names));
    textareaRef.current?.focus();
  }, []);

  // ---- Render ----

  return (
    <div
      ref={containerRef}
      className="shrink-0 relative"
      style={{
        padding: "8px 16px 12px",
        borderTop: "1px solid var(--pn-border-subtle)",
        background: "rgba(14,16,23,0.55)",
        backdropFilter: "blur(20px)",
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Typing indicator — above the input */}
      <TypingIndicator members={typingMembers} />

      {/* Slash command dropdown */}
      {menuKind === "slash" && (
        <SlashCommandMenu
          filter={menuFilter}
          activeIndex={menuIndex}
          onSelect={handleSlashSelect}
        />
      )}

      {/* @mention dropdown */}
      {menuKind === "mention" && (
        <MentionMenu
          filter={menuFilter}
          members={members}
          activeIndex={menuIndex}
          onSelect={handleMentionSelect}
        />
      )}

      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg pointer-events-none"
          style={{
            background: "rgba(88,101,242,0.1)",
            border: "2px dashed rgba(88,101,242,0.5)",
          }}
        >
          <span className="text-lg" style={{ color: "#5865F2" }}>+</span>
          <span className="text-[0.75rem] font-medium" style={{ color: "#5865F2" }}>
            Drop files to attach
          </span>
        </div>
      )}

      {/* Input row */}
      <div
        className="flex items-end gap-2 rounded-lg transition-all duration-150"
        style={{
          padding: "8px 12px",
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${isDragging ? "rgba(88,101,242,0.5)" : "var(--pn-border-default)"}`,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "rgba(88,101,242,0.5)";
          e.currentTarget.style.boxShadow = "0 0 0 2px rgba(88,101,242,0.1)";
        }}
        onBlur={(e) => {
          if (!isDragging) {
            e.currentTarget.style.borderColor = "var(--pn-border-default)";
            e.currentTarget.style.boxShadow = "none";
          }
        }}
      >
        {/* Emoji toggle */}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            setShowEmoji((prev) => !prev);
          }}
          className="shrink-0 mb-0.5 transition-colors"
          style={{
            color: showEmoji ? "#5865F2" : "var(--pn-text-muted)",
            fontSize: "1rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px",
          }}
          title="Emoji"
        >
          {"\u263A"}
        </button>

        {/* Emoji picker popover */}
        {showEmoji && (
          <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmoji(false)} />
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Channel not active..." : (placeholder ?? "Message channel...")}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent outline-none resize-none text-[0.8rem]"
          style={{
            color: "var(--pn-text-primary)",
            maxHeight: `${MAX_HEIGHT_PX}px`,
            lineHeight: `${LINE_HEIGHT_PX}px`,
            border: "none",
            fontFamily: "inherit",
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="shrink-0 mb-0.5 transition-colors"
          style={{
            color: text.trim() && !disabled ? "#5865F2" : "var(--pn-text-muted)",
            fontSize: "1rem",
            background: "none",
            border: "none",
            cursor: text.trim() && !disabled ? "pointer" : "default",
            padding: "2px",
          }}
          title="Send (Enter)"
        >
          {"\u27A4"}
        </button>
      </div>

      {/* Footer hints + char counter */}
      <div className="flex items-center justify-between mt-1 px-1">
        <span className="text-[0.6rem]" style={{ color: "var(--pn-text-muted)" }}>
          Enter to send {"\u00B7"} Shift+Enter for new line {"\u00B7"} / for commands {"\u00B7"} @ to mention
        </span>
        {text.length > 1500 && (
          <span
            className="text-[0.6rem]"
            style={{ color: text.length > MAX_CHARS ? "var(--color-pn-error, #f23f43)" : "var(--pn-text-tertiary)" }}
          >
            {text.length}/{MAX_CHARS}
          </span>
        )}
      </div>
    </div>
  );
}
