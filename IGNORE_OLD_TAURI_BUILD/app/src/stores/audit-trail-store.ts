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

interface AuditReport {
  readonly ok: boolean;
  readonly report: SecurityPosture;
}

interface AuditTrailState {
  posture: SecurityPosture | null;
  loading: boolean;
  error: string | null;
  auditing: boolean;
  loadViaRest: () => Promise<void>;
  runAudit: () => Promise<void>;
}

export type { SecurityPosture, SecurityCheck, SupplyChainWarning };

export const useAuditTrailStore = create<AuditTrailState>((set) => ({
  posture: null,
  loading: false,
  error: null,
  auditing: false,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const posture = await api.get<SecurityPosture>("/security/posture");
      set({ posture, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async runAudit() {
    set({ auditing: true });
    try {
      const res = await api.post<AuditReport>("/security/audit", {});
      set({ posture: res.report, auditing: false });
    } catch (e) {
      set({
        error: String(e),
        auditing: false,
      });
    }
  },
}));
