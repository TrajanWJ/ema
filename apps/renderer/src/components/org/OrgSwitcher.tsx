import { useState, useRef, useEffect } from "react";
import { useOrgStore } from "@/stores/org-store";

export function OrgSwitcher() {
  const orgs = useOrgStore((s) => s.orgs);
  const activeOrg = useOrgStore((s) => s.activeOrg);
  const setActiveOrg = useOrgStore((s) => s.setActiveOrg);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const label = activeOrg?.name ?? "Personal";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-w-[164px] items-center gap-2.5 rounded-[12px] border px-3 py-1.5 hover:bg-white/5 transition-all"
        style={{
          color: "var(--pn-text-secondary)",
          borderColor: "rgba(255,255,255,0.08)",
          background: "rgba(14, 16, 23, 0.55)",
          backdropFilter: "blur(20px) saturate(150%)",
          WebkitBackdropFilter: "blur(20px) saturate(150%)",
        }}
      >
        <span
          className="flex h-[20px] w-[20px] items-center justify-center rounded text-[0.58rem] font-bold"
          style={{ background: "rgba(45, 212, 168, 0.15)", color: "#2dd4a8" }}
        >
          {label.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-[124px] flex-1 truncate text-left text-[0.72rem] font-medium">{label}</span>
        <span className="text-[0.58rem]" style={{ color: "var(--pn-text-muted)" }}>
          {open ? "\u25B4" : "\u25BE"}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-xl py-1.5 shadow-lg glass-elevated"
          style={{ border: "1px solid var(--pn-border-subtle)" }}
        >
          {orgs.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => { setActiveOrg(org); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3.5 py-2 hover:bg-white/5 transition-all"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[0.55rem] font-bold"
                style={{ background: "rgba(45, 212, 168, 0.12)", color: "#2dd4a8" }}
              >
                {org.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate text-[0.7rem]" style={{
                color: activeOrg?.id === org.id ? "#2dd4a8" : "var(--pn-text-primary)"
              }}>
                {org.name}
              </span>
              {activeOrg?.id === org.id && (
                <span className="ml-auto text-[0.55rem]" style={{ color: "#2dd4a8" }}>&check;</span>
              )}
            </button>
          ))}

          {orgs.length === 0 && (
            <div className="px-3.5 py-2.5 text-[0.65rem]" style={{ color: "var(--pn-text-muted)" }}>
              No organizations
            </div>
          )}
        </div>
      )}
    </div>
  );
}
