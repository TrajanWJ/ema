import { useOrgStore } from "@/stores/org-store";
import { MemberCard } from "./MemberCard";
import { InvitationCreator } from "./InvitationCreator";
import { useState } from "react";
import type { Organization } from "@/types/org";

interface Props {
  org: Organization;
  onBack: () => void;
  onSettings: () => void;
}

export function OrgDashboard({ org, onBack, onSettings }: Props) {
  const members = useOrgStore((s) => s.members);
  const invitations = useOrgStore((s) => s.invitations);
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-[0.7rem] px-2 py-0.5 rounded hover:bg-white/5"
            style={{ color: "var(--pn-text-tertiary)" }}
          >
            &larr; Back
          </button>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[0.85rem] font-semibold"
            style={{ background: "rgba(45, 212, 168, 0.12)", color: "#2dd4a8" }}
          >
            {org.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-[0.85rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
              {org.name}
            </h2>
            {org.description && (
              <p className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                {org.description}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onSettings}
          className="text-[0.65rem] px-2.5 py-1 rounded hover:bg-white/5"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          Settings
        </button>
      </div>

      {/* Members section */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[0.75rem] font-medium" style={{ color: "var(--pn-text-secondary)" }}>
            Members ({members.length})
          </h3>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="text-[0.65rem] font-medium px-2.5 py-1 rounded"
            style={{ background: "rgba(107, 149, 240, 0.12)", color: "#6b95f0" }}
          >
            {showInvite ? "Cancel" : "+ Invite"}
          </button>
        </div>

        {showInvite && (
          <div className="glass-surface rounded-lg p-3 mb-3">
            <InvitationCreator orgId={org.id} onDone={() => setShowInvite(false)} />
          </div>
        )}

        <div className="space-y-2">
          {members.map((member) => (
            <MemberCard key={member.id} member={member} orgId={org.id} />
          ))}
          {members.length === 0 && (
            <p className="text-[0.7rem] text-center py-6" style={{ color: "var(--pn-text-muted)" }}>
              No members yet
            </p>
          )}
        </div>

        {/* Active invitations */}
        {invitations.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[0.75rem] font-medium mb-2" style={{ color: "var(--pn-text-secondary)" }}>
              Active Invitations ({invitations.length})
            </h3>
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div key={inv.id} className="glass-ambient rounded-lg p-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-[0.7rem]" style={{ color: "var(--pn-text-primary)" }}>
                      Role: <span className="font-medium">{inv.role}</span>
                    </div>
                    <div className="text-[0.6rem]" style={{ color: "var(--pn-text-muted)" }}>
                      Used {inv.use_count}{inv.max_uses ? `/${inv.max_uses}` : ""} times
                      {inv.expires_at && ` \u00b7 Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(inv.link)}
                      className="text-[0.6rem] px-2 py-0.5 rounded hover:bg-white/5"
                      style={{ color: "#6b95f0" }}
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={() => useOrgStore.getState().revokeInvitation(inv.organization_id, inv.id)}
                      className="text-[0.6rem] px-2 py-0.5 rounded hover:bg-white/5"
                      style={{ color: "#ef4444" }}
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
