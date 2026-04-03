export function CommandBar() {
  return (
    <div
      className="glass-ambient flex items-center px-4 shrink-0"
      style={{ height: "40px", borderTop: "1px solid var(--pn-border-subtle)" }}
    >
      <div className="flex items-center gap-2 flex-1">
        <span className="text-[0.65rem]" style={{ color: "var(--pn-text-muted)" }}>
          &#128269;
        </span>
        <input
          type="text"
          placeholder="Search everything..."
          className="bg-transparent border-none outline-none text-[0.7rem] flex-1 cursor-pointer"
          style={{ color: "var(--pn-text-secondary)" }}
          readOnly
        />
        <span
          className="text-[0.6rem] px-1.5 py-0.5 rounded"
          style={{
            color: "var(--pn-text-muted)",
            background: "rgba(255, 255, 255, 0.04)",
          }}
        >
          Ctrl+K
        </span>
      </div>
    </div>
  );
}
