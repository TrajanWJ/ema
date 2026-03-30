import { useState, useRef, useCallback } from "react";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  return (
    <div
      className="px-4 py-3 shrink-0"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(14,16,23,0.55)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div
        className="flex items-end gap-2 px-3 py-2 rounded-lg transition-all duration-150"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(88,101,242,0.5)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 2px rgba(88,101,242,0.1)";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={disabled ? "Channel not active..." : (placeholder ?? "Message channel...")}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent outline-none resize-none max-h-[200px] text-[0.8rem]"
          style={{
            color: "rgba(255,255,255,0.85)",
          }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="shrink-0 mb-0.5 transition-colors"
          style={{
            color: text.trim() && !disabled ? "#5865F2" : "rgba(255,255,255,0.2)",
            fontSize: "1rem",
          }}
          title="Send (Enter)"
        >
          ➤
        </button>
      </div>
      <div className="flex items-center mt-1 px-1">
        <span className="text-[0.6rem]" style={{ color: "rgba(255,255,255,0.2)" }}>
          Enter to send · Shift+Enter for new line
        </span>
      </div>
    </div>
  );
}
