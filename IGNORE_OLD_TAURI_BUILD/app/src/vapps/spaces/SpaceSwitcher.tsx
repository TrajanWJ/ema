import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface Space {
  id: string;
  name: string;
  space_type: "personal" | "team" | "project";
  org_id: string;
  icon: string | null;
  color: string | null;
}

interface Org {
  id: string;
  name: string;
}

interface SpacesResponse {
  spaces: Space[];
  orgs: Org[];
}

export interface SpaceSwitcherProps {
  onSpaceChange?: (spaceId: string) => void;
  className?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const LS_KEY = "ema_current_space_id";

const TYPE_BADGE_COLORS: Record<Space["space_type"], { bg: string; text: string }> = {
  personal: { bg: "rgba(45, 212, 168, 0.15)", text: "#2dd4a8" },
  team: { bg: "rgba(107, 149, 240, 0.15)", text: "#6b95f0" },
  project: { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function spaceIcon(space: Space): string {
  if (space.icon) return space.icon;
  return space.name.charAt(0).toUpperCase();
}

function groupByOrg(spaces: Space[], orgs: Org[]): Array<{ org: Org; spaces: Space[] }> {
  const orgMap = new Map(orgs.map((o) => [o.id, o]));
  const groups = new Map<string, Space[]>();

  for (const space of spaces) {
    const existing = groups.get(space.org_id) ?? [];
    groups.set(space.org_id, [...existing, space]);
  }

  return Array.from(groups.entries()).map(([orgId, orgSpaces]) => ({
    org: orgMap.get(orgId) ?? { id: orgId, name: orgId },
    spaces: orgSpaces,
  }));
}

// ── Component ────────────────────────────────────────────────────────────────

export function SpaceSwitcher({ onSpaceChange, className }: SpaceSwitcherProps) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Fetch spaces on mount ─────────────────────────────────────────────────
  useEffect(() => {
    async function fetchSpaces() {
      try {
        const data = await api.get<SpacesResponse>("/spaces");
        setSpaces(data.spaces ?? []);
        setOrgs(data.orgs ?? []);

        // Resolve current space
        const stored = localStorage.getItem(LS_KEY);
        const found = stored && data.spaces.find((s) => s.id === stored);
        if (found) {
          setCurrentSpaceId(found.id);
        } else {
          // Default to first personal space
          const personal = data.spaces.find((s) => s.space_type === "personal");
          const fallback = personal ?? data.spaces[0] ?? null;
          if (fallback) {
            setCurrentSpaceId(fallback.id);
            localStorage.setItem(LS_KEY, fallback.id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load spaces");
      } finally {
        setLoading(false);
      }
    }

    fetchSpaces();
  }, []);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // ── Select space ──────────────────────────────────────────────────────────
  const selectSpace = useCallback(
    (spaceId: string) => {
      setCurrentSpaceId(spaceId);
      localStorage.setItem(LS_KEY, spaceId);
      setOpen(false);
      onSpaceChange?.(spaceId);
    },
    [onSpaceChange]
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentSpace = spaces.find((s) => s.id === currentSpaceId) ?? null;
  const grouped = groupByOrg(spaces, orgs);

  // ── Styles ────────────────────────────────────────────────────────────────
  const triggerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 8px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(14, 16, 23, 0.55)",
    backdropFilter: "blur(20px) saturate(150%)",
    WebkitBackdropFilter: "blur(20px) saturate(150%)",
    cursor: "pointer",
    color: "rgba(255,255,255,0.87)",
    fontSize: "0.75rem",
    fontFamily: "system-ui, -apple-system, sans-serif",
    transition: "background 0.15s ease, border-color 0.15s ease",
    outline: "none",
    minWidth: 0,
  };

  const dropdownStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    zIndex: 9999,
    minWidth: "220px",
    background: "rgba(10, 12, 20, 0.94)",
    backdropFilter: "blur(28px) saturate(180%)",
    WebkitBackdropFilter: "blur(28px) saturate(180%)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    boxShadow: "0 18px 48px rgba(0,0,0,0.48), 0 6px 18px rgba(0,0,0,0.26)",
    padding: "6px",
    overflowY: "auto",
    maxHeight: "320px",
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: "0.6rem",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.35)",
    padding: "6px 8px 3px",
  };

  const spaceRowStyle = (isActive: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px",
    borderRadius: "6px",
    cursor: "pointer",
    background: isActive ? "rgba(45,212,168,0.06)" : "transparent",
    border: "none",
    width: "100%",
    textAlign: "left",
    transition: "background 0.1s ease",
  });

  const iconStyle = (color: string | null): React.CSSProperties => ({
    width: "22px",
    height: "22px",
    borderRadius: "5px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.6rem",
    fontWeight: 700,
    flexShrink: 0,
    background: color ? `${color}26` : "rgba(45,212,168,0.12)",
    color: color ?? "#2dd4a8",
  });

  const badgeStyle = (type: Space["space_type"]): React.CSSProperties => {
    const c = TYPE_BADGE_COLORS[type];
    return {
      fontSize: "0.5rem",
      fontWeight: 600,
      padding: "1px 5px",
      borderRadius: "4px",
      background: c.bg,
      color: c.text,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      flexShrink: 0,
    };
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", display: "inline-block" }}
    >
      {/* Trigger button */}
      <button
        style={triggerStyle}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "rgba(14,16,23,0.75)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "rgba(14,16,23,0.55)")
        }
      >
        {loading ? (
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.7rem" }}>…</span>
        ) : error ? (
          <span style={{ color: "#e24b4a", fontSize: "0.7rem" }}>!</span>
        ) : (
          <>
            {/* Space icon */}
            <span
              style={{
                ...iconStyle(currentSpace?.color ?? null),
                width: "18px",
                height: "18px",
                fontSize: "0.55rem",
              }}
            >
              {currentSpace ? spaceIcon(currentSpace) : "?"}
            </span>

            {/* Space name */}
            <span
              style={{
                maxWidth: "120px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: "0.72rem",
              }}
            >
              {currentSpace?.name ?? "Select space"}
            </span>

            {/* Chevron */}
            <span
              style={{
                fontSize: "0.55rem",
                color: "rgba(255,255,255,0.35)",
                transition: "transform 0.15s ease",
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
                display: "inline-block",
                marginLeft: "2px",
              }}
            >
              ▾
            </span>
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && !loading && !error && (
        <div style={dropdownStyle} role="listbox">
          {grouped.length === 0 && (
            <div style={{ padding: "12px 8px", color: "rgba(255,255,255,0.35)", fontSize: "0.7rem", textAlign: "center" }}>
              No spaces found
            </div>
          )}

          {grouped.map(({ org, spaces: orgSpaces }) => (
            <div key={org.id}>
              {/* Org section header */}
              <div style={sectionHeaderStyle}>{org.name}</div>

              {orgSpaces.map((space) => {
                const isActive = space.id === currentSpaceId;
                return (
                  <button
                    key={space.id}
                    style={spaceRowStyle(isActive)}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => selectSpace(space.id)}
                    onMouseEnter={(e) =>
                      !isActive &&
                      ((e.currentTarget as HTMLElement).style.background =
                        "rgba(255,255,255,0.04)")
                    }
                    onMouseLeave={(e) =>
                      !isActive &&
                      ((e.currentTarget as HTMLElement).style.background = "transparent")
                    }
                  >
                    {/* Icon */}
                    <span style={iconStyle(space.color)}>{spaceIcon(space)}</span>

                    {/* Name */}
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: "0.72rem",
                        color: isActive ? "#2dd4a8" : "rgba(255,255,255,0.87)",
                        fontWeight: isActive ? 500 : 400,
                      }}
                    >
                      {space.name}
                    </span>

                    {/* Type badge */}
                    <span style={badgeStyle(space.space_type)}>{space.space_type}</span>

                    {/* Active checkmark */}
                    {isActive && (
                      <span style={{ color: "#2dd4a8", fontSize: "0.75rem", marginLeft: "4px" }}>
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SpaceSwitcher;
