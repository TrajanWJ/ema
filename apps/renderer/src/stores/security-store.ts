import { create } from "zustand";
import { api } from "@/lib/api";

interface SecurityCheck {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly points: number;
  readonly max_points: number;
  readonly fix_guide: string;
}

interface SupplyChainWarning {
  readonly id: string;
  readonly severity: string;
  readonly title: string;
  readonly description: string;
  readonly mitigation: string;
}

interface SecurityPosture {
  readonly score: number;
  readonly max_score: number;
  readonly percent: number;
  readonly checks: readonly SecurityCheck[];
  readonly supply_chain_warnings: readonly SupplyChainWarning[];
  readonly audited_at: string;
}

interface SecurityState {
  posture: SecurityPosture | null;
  loading: boolean;
  auditing: boolean;
  loadPosture: () => Promise<void>;
  runAudit: () => Promise<void>;
}

export const useSecurityStore = create<SecurityState>((set) => ({
  posture: null,
  loading: false,
  auditing: false,

  loadPosture: async () => {
    set({ loading: true });
    try {
      const posture = await api.get<SecurityPosture>("/security/posture");
      set({ posture, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  runAudit: async () => {
    set({ auditing: true });
    try {
      const res = await api.post<{ ok: boolean; report: SecurityPosture }>("/security/audit", {});
      set({ posture: res.report, auditing: false });
    } catch {
      set({ auditing: false });
    }
  },
}));
