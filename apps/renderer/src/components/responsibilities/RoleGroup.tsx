import { useState } from "react";
import type { Responsibility } from "@/types/responsibilities";
import { ResponsibilityCard } from "./ResponsibilityCard";

interface RoleGroupProps {
  readonly role: string;
  readonly responsibilities: readonly Responsibility[];
}

export function RoleGroup({ role, responsibilities }: RoleGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const activeCount = responsibilities.filter((r) => r.active).length;

  return (
    <div className="mb-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left mb-2"
      >
        <span
          className="text-[0.6rem] transition-transform"
          style={{
            color: "var(--pn-text-tertiary)",
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
          }}
        >
          &#9660;
        </span>
        <span
          className="text-[0.7rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          {role}
        </span>
        <span
          className="text-[0.6rem]"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          ({activeCount})
        </span>
      </button>

      {!collapsed && (
        <div className="pl-4">
          {responsibilities.map((r) => (
            <ResponsibilityCard key={r.id} responsibility={r} />
          ))}
        </div>
      )}
    </div>
  );
}
