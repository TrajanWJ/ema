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
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/5 transition-all"
        style={{ color: "var(--pn-text-secondary)" }}
      >
        <span
          className="w-4 h-4 rounded flex items-center justify-center text-[0.5rem] font-bold"
          style={{ background: "rgba(45, 212, 168, 0.15)", color: "#2dd4a8" }}
        >
          {label.charAt(0).toUpperCase()}
        </span>
        <span className="text-[0.6rem] font-medium max-w-[80px] truncate">{label}</span>
        <span className="text-[0.5rem]" style={{ color: "var(--pn-text-muted)" }}>
          {open ? "\u25B4" : "\u25BE"}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 glass-elevated rounded-lg py-1 z-50 min-w-[180px] shadow-lg"
          style={{ border: "1px solid var(--pn-border-subtle)" }}
        >
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => { setActiveOrg(org); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-all"
            >
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-[0.5rem] font-bold shrink-0"
                style={{ background: "rgba(45, 212, 168, 0.12)", color: "#2dd4a8" }}
              >
                {org.name.charAt(0).toUpperCase()}
              </span>
              <span className="text-[0.65rem] truncate" style={{
                color: activeOrg?.id === org.id ? "#2dd4a8" : "var(--pn-text-primary)"
              }}>
                {org.name}
              </span>
              {activeOrg?.id === org.id && (
                <span className="ml-auto text-[0.5rem]" style={{ color: "#2dd4a8" }}>&check;</span>
              )}
            </button>
          ))}

          {orgs.length === 0 && (
            <div className="px-3 py-2 text-[0.6rem]" style={{ color: "var(--pn-text-muted)" }}>
              No organizations
            </div>
          )}
        </div>
      )}
    </div>
  );
}
