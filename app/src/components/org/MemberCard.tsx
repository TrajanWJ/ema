import { useState } from "react";
import { useOrgStore } from "@/stores/org-store";
import type { OrgMember } from "@/types/org";

const ROLE_COLORS: Record<string, string> = {
  owner: "#f59e0b",
  admin: "#a78bfa",
  member: "#6b95f0",
  guest: "var(--pn-text-tertiary)",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  invited: "#f59e0b",
  suspended: "#ef4444",
};

interface Props {
  member: OrgMember;
  orgId: string;
}

export function MemberCard({ member, orgId }: Props) {
  const [showActions, setShowActions] = useState(false);
  const removeMember = useOrgStore((s) => s.removeMember);
  const updateRole = useOrgStore((s) => s.updateRole);

  const lastSeen = member.last_seen_at
    ? new Date(member.last_seen_at).toLocaleDateString()
    : "Never";

  return (
    <div
      className="glass-ambient rounded-lg p-2.5 flex items-center gap-3 group"
      onClick={() => setShowActions(!showActions)}
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[0.75rem] font-semibold shrink-0"
        style={{
          background: `${ROLE_COLORS[member.role]}20`,
          color: ROLE_COLORS[member.role],
        }}
      >
        {member.display_name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] font-medium truncate" style={{ color: "var(--pn-text-primary)" }}>
            {member.display_name}
          </span>
          <span
            className="text-[0.55rem] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: `${ROLE_COLORS[member.role]}20`, color: ROLE_COLORS[member.role] }}
          >
            {member.role}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[0.6rem]" style={{ color: "var(--pn-text-muted)" }}>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: STATUS_COLORS[member.status] }}
          />
          <span>{member.status}</span>
          <span>&middot;</span>
          <span>Last seen: {lastSeen}</span>
        </div>
      </div>

      {/* Actions */}
      {showActions && member.role !== "owner" && (
        <div className="flex items-center gap-1.5">
          {(["admin", "member", "guest"] as const)
            .filter((r) => r !== member.role)
            .map((role) => (
              <button
                key={role}
                onClick={(e) => { e.stopPropagation(); updateRole(orgId, member.id, role); }}
                className="text-[0.55rem] px-1.5 py-0.5 rounded hover:bg-white/5"
                style={{ color: ROLE_COLORS[role] }}
              >
                {role}
              </button>
            ))}
          <button
            onClick={(e) => { e.stopPropagation(); removeMember(orgId, member.id); }}
            className="text-[0.55rem] px-1.5 py-0.5 rounded hover:bg-white/5"
            style={{ color: "#ef4444" }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
