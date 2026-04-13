import { useState, useCallback } from "react";
import { useChannelsStore } from "@/stores/channels-store";
import type { Member } from "@/stores/channels-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  online: "#23a55a",
  idle: "#f0b232",
  dnd: "#f23f43",
  offline: "rgba(255,255,255,0.2)",
};

const STATUS_LABELS: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  offline: "Offline",
};

const ROLE_BADGE_STYLES: Record<string, { bg: string; fg: string; border: string }> = {
  Admin: { bg: "rgba(88,101,242,0.15)", fg: "#818cf8", border: "rgba(88,101,242,0.3)" },
  Agent: { bg: "rgba(45,212,168,0.1)", fg: "#2dd4a8", border: "rgba(45,212,168,0.25)" },
  Bot: { bg: "rgba(245,158,11,0.1)", fg: "#f59e0b", border: "rgba(245,158,11,0.25)" },
};

const DEFAULT_BADGE_STYLE = {
  bg: "rgba(255,255,255,0.05)",
  fg: "var(--pn-text-tertiary)",
  border: "rgba(255,255,255,0.08)",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_BADGE_STYLES[role] ?? DEFAULT_BADGE_STYLE;
  return (
    <span
      className="text-[0.55rem] font-medium leading-none shrink-0"
      style={{
        padding: "2px 6px",
        borderRadius: "9999px",
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
      }}
    >
      {role}
    </span>
  );
}

function MemberAvatar({ member, size = 28 }: { member: Member; size?: number }) {
  const initials = member.name
    .split(/[\s\-_]/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const fontSize = size <= 28 ? "0.6rem" : "0.8rem";
  const dotSize = size <= 28 ? 9 : 11;

  return (
    <div className="relative shrink-0" style={{ width: `${size}px`, height: `${size}px` }}>
      <div
        className="flex items-center justify-center rounded-full font-bold"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          fontSize,
          background: member.accent ? `${member.accent}18` : "rgba(255,255,255,0.05)",
          border: `1.5px solid ${member.accent ? `${member.accent}30` : "rgba(255,255,255,0.08)"}`,
          color: member.accent ?? "var(--pn-text-tertiary)",
        }}
      >
        {initials || "?"}
      </div>
      <span
        className="absolute rounded-full"
        title={STATUS_LABELS[member.status] ?? "Unknown"}
        style={{
          width: `${dotSize}px`,
          height: `${dotSize}px`,
          bottom: "-1px",
          right: "-1px",
          background: STATUS_COLORS[member.status] ?? STATUS_COLORS.offline,
          border: "2px solid rgba(14,16,23,0.9)",
        }}
      />
    </div>
  );
}

function MemberRow({
  member,
  onSelect,
}: {
  member: Member;
  onSelect: (member: Member) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isInactive = member.status === "offline";

  return (
    <button
      onClick={() => onSelect(member)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-2.5 text-left transition-all duration-100"
      style={{
        padding: "6px 8px",
        borderRadius: "6px",
        color: hovered ? "var(--pn-text-primary)" : isInactive ? "var(--pn-text-tertiary)" : "var(--pn-text-secondary)",
        background: hovered ? "rgba(255,255,255,0.05)" : "transparent",
        opacity: isInactive && !hovered ? 0.7 : 1,
        border: "none",
        cursor: "pointer",
      }}
      title={`${member.name}${member.role ? ` \u2014 ${member.role}` : ""}`}
    >
      <MemberAvatar member={member} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[0.75rem] font-medium truncate">{member.name}</span>
          {member.role && <RoleBadge role={member.role} />}
        </div>
        {member.isTyping && (
          <span className="text-[0.6rem] italic" style={{ color: "#5865F2" }}>
            <span style={{ animation: "memberTypingPulse 1.5s infinite" }}>typing...</span>
            <style>{`@keyframes memberTypingPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
          </span>
        )}
      </div>
    </button>
  );
}

function CollapsibleSection({
  label,
  count,
  defaultOpen,
  children,
}: {
  label: string;
  count: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center gap-1 px-2 py-1 text-left transition-colors"
        style={{
          color: "var(--pn-text-muted)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "0.6rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--pn-text-tertiary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--pn-text-muted)"; }}
      >
        <span
          className="text-[0.5rem] transition-transform duration-150"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", display: "inline-block" }}
        >
          {"\u25BC"}
        </span>
        <span>{label}</span>
        <span>{"\u2014"} {count}</span>
      </button>
      {open && <div className="mt-0.5">{children}</div>}
    </div>
  );
}

function MemberProfile({
  member,
  onClose,
  onStartDM,
}: {
  member: Member;
  onClose: () => void;
  onStartDM: (member: Member) => void;
}) {
  return (
    <div
      className="absolute inset-x-2 bottom-2 rounded-lg z-10 flex flex-col gap-3"
      style={{
        padding: "14px",
        background: "rgba(14,16,23,0.92)",
        backdropFilter: "blur(20px)",
        border: "1px solid var(--pn-border-default)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-[0.7rem] transition-colors"
        style={{ color: "var(--pn-text-muted)", background: "none", border: "none", cursor: "pointer" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--pn-text-secondary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--pn-text-muted)"; }}
      >
        {"\u2715"}
      </button>

      {/* Header: avatar + name + status */}
      <div className="flex items-center gap-3">
        <MemberAvatar member={member} size={40} />
        <div>
          <div className="text-[0.85rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
            {member.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="rounded-full inline-block"
              style={{
                width: "8px",
                height: "8px",
                background: STATUS_COLORS[member.status] ?? STATUS_COLORS.offline,
              }}
            />
            <span className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
              {STATUS_LABELS[member.status] ?? "Unknown"}
            </span>
          </div>
        </div>
      </div>

      {/* Role */}
      {member.role && (
        <div className="flex items-center gap-2">
          <span className="text-[0.6rem] uppercase tracking-wider" style={{ color: "var(--pn-text-muted)" }}>
            Role
          </span>
          <RoleBadge role={member.role} />
        </div>
      )}

      {/* DM action */}
      <button
        onClick={() => onStartDM(member)}
        className="w-full py-1.5 rounded-md text-[0.7rem] font-medium transition-colors"
        style={{
          background: "rgba(88,101,242,0.15)",
          color: "#818cf8",
          border: "1px solid rgba(88,101,242,0.3)",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(88,101,242,0.25)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(88,101,242,0.15)"; }}
      >
        Message {member.name}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MemberList
// ---------------------------------------------------------------------------

export function MemberList() {
  const members = useChannelsStore((s) => s.members);
  const sendMessage = useChannelsStore((s) => s.sendMessage);
  const [filter, setFilter] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const filtered = filter
    ? members.filter((m) => m.name.toLowerCase().includes(filter.toLowerCase()))
    : members;

  const online = filtered.filter((m) => m.status === "online" || m.status === "dnd");
  const idle = filtered.filter((m) => m.status === "idle");
  const offline = filtered.filter((m) => m.status === "offline");

  const handleSelect = useCallback((member: Member) => {
    setSelectedMember((prev) => (prev?.id === member.id ? null : member));
  }, []);

  const handleStartDM = useCallback(
    (member: Member) => {
      sendMessage(`/dm ${member.name} `);
      setSelectedMember(null);
    },
    [sendMessage],
  );

  return (
    <div
      className="flex flex-col shrink-0 relative"
      style={{
        width: "200px",
        background: "rgba(14,16,23,0.45)",
        backdropFilter: "blur(20px)",
        borderLeft: "1px solid var(--pn-border-subtle)",
      }}
    >
      {/* Filter input */}
      <div style={{ padding: "10px 8px 4px" }}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter members..."
          className="w-full text-[0.7rem] outline-none"
          style={{
            padding: "5px 8px",
            borderRadius: "4px",
            border: "1px solid var(--pn-border-default)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--pn-text-secondary)",
          }}
        />
      </div>

      {/* Scrollable member list */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "8px" }}>
        <CollapsibleSection label="Online" count={online.length} defaultOpen={true}>
          {online.map((m) => (
            <MemberRow key={m.id} member={m} onSelect={handleSelect} />
          ))}
        </CollapsibleSection>

        <CollapsibleSection label="Idle" count={idle.length} defaultOpen={true}>
          {idle.map((m) => (
            <MemberRow key={m.id} member={m} onSelect={handleSelect} />
          ))}
        </CollapsibleSection>

        <CollapsibleSection label="Offline" count={offline.length} defaultOpen={false}>
          {offline.map((m) => (
            <MemberRow key={m.id} member={m} onSelect={handleSelect} />
          ))}
        </CollapsibleSection>

        {/* Empty state when filter yields nothing */}
        {online.length === 0 && idle.length === 0 && offline.length === 0 && filter && (
          <div className="text-center py-4">
            <span className="text-[0.7rem]" style={{ color: "var(--pn-text-muted)" }}>
              No members match "{filter}"
            </span>
          </div>
        )}
      </div>

      {/* Profile card overlay */}
      {selectedMember && (
        <MemberProfile
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onStartDM={handleStartDM}
        />
      )}
    </div>
  );
}
