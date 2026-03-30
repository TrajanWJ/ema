import { useChannelsStore } from "@/stores/channels-store";
import type { Member } from "@/stores/channels-store";

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

function MemberRow({ member }: { member: Member }) {
  const initials = member.name
    .split(/[\s-_]/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors cursor-default"
      style={{ color: "rgba(255,255,255,0.5)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)";
        (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.85)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
        (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.5)";
      }}
    >
      {/* Avatar with status dot */}
      <div className="relative shrink-0">
        <div
          className="flex items-center justify-center rounded-full text-[0.6rem] font-bold"
          style={{
            width: "28px",
            height: "28px",
            background: member.accent ? `${member.accent}20` : "rgba(255,255,255,0.06)",
            border: `1px solid ${member.accent ? `${member.accent}33` : "rgba(255,255,255,0.08)"}`,
            color: member.accent ?? "rgba(255,255,255,0.5)",
          }}
        >
          {initials || "?"}
        </div>
        <span
          className="absolute bottom-0 right-0 rounded-full"
          title={STATUS_LABELS[member.status] ?? "Unknown"}
          style={{
            width: "8px",
            height: "8px",
            background: STATUS_COLORS[member.status] ?? STATUS_COLORS.offline,
            border: "1.5px solid rgba(14,16,23,0.9)",
          }}
        />
      </div>

      <div className="min-w-0">
        <div className="text-[0.75rem] font-medium truncate">{member.name}</div>
        {member.role && (
          <div className="text-[0.6rem] truncate" style={{ color: "rgba(255,255,255,0.25)" }}>
            {member.role}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberGroup({ label, members }: { label: string; members: Member[] }) {
  if (members.length === 0) return null;
  return (
    <div className="mb-4">
      <div
        className="text-[0.6rem] font-semibold uppercase tracking-wider px-2 py-1"
        style={{ color: "rgba(255,255,255,0.25)" }}
      >
        {label} — {members.length}
      </div>
      {members.map((m) => (
        <MemberRow key={m.id} member={m} />
      ))}
    </div>
  );
}

export function MemberList() {
  const members = useChannelsStore((s) => s.members);

  const online = members.filter((m) => m.status === "online");
  const idle = members.filter((m) => m.status === "idle");
  const dnd = members.filter((m) => m.status === "dnd");
  const offline = members.filter((m) => m.status === "offline");

  return (
    <div
      className="flex flex-col shrink-0 overflow-y-auto py-3 px-2"
      style={{
        width: "200px",
        background: "rgba(14,16,23,0.45)",
        backdropFilter: "blur(20px)",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <MemberGroup label="Online" members={[...online, ...dnd]} />
      <MemberGroup label="Idle" members={idle} />
      <MemberGroup label="Offline" members={offline} />
    </div>
  );
}
