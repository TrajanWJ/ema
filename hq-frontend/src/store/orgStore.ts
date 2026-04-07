import { create } from "zustand";
import type { Organization, OrgMember, OrgInvitation } from "../api/hq";
import * as hq from "../api/hq";

export type { Organization, OrgMember, OrgInvitation };

interface OrgStore {
  orgs: Organization[];
  activeOrg: Organization | null;
  members: OrgMember[];
  invitations: OrgInvitation[];
  loading: boolean;
  error: string | null;

  loadOrgs: () => Promise<void>;
  setActiveOrg: (org: Organization | null) => void;
  loadOrgDetail: (id: string) => Promise<void>;
  createOrg: (data: Partial<Organization>) => Promise<Organization>;
  updateOrg: (id: string, data: Partial<Organization>) => Promise<void>;
  deleteOrg: (id: string) => Promise<void>;
  createInvitation: (orgId: string, data: { role?: string; expires_at?: string; max_uses?: number }) => Promise<{ invitation: OrgInvitation; link: string }>;
  revokeInvitation: (orgId: string, invId: string) => Promise<void>;
}

export const useOrgStore = create<OrgStore>((set, get) => ({
  orgs: [],
  activeOrg: null,
  members: [],
  invitations: [],
  loading: false,
  error: null,

  async loadOrgs() {
    set({ loading: true, error: null });
    try {
      const data = await hq.getOrgs();
      set({ orgs: data.orgs, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  setActiveOrg(org) {
    set({ activeOrg: org, members: [], invitations: [] });
    if (org) get().loadOrgDetail(org.id).catch(() => {});
  },

  async loadOrgDetail(id) {
    const data = await hq.getOrg(id);
    set({ members: data.members, invitations: data.invitations });
  },

  async createOrg(data) {
    const org = await hq.createOrg(data);
    set((state) => ({ orgs: [org, ...state.orgs] }));
    return org;
  },

  async updateOrg(id, data) {
    await hq.updateOrg(id, data);
    await get().loadOrgs();
  },

  async deleteOrg(id) {
    await hq.deleteOrg(id);
    set((state) => ({
      orgs: state.orgs.filter((o) => o.id !== id),
      activeOrg: state.activeOrg?.id === id ? null : state.activeOrg,
    }));
  },

  async createInvitation(orgId, data) {
    const result = await hq.createInvitation(orgId, data);
    set((state) => ({ invitations: [result.invitation, ...state.invitations] }));
    return result;
  },

  async revokeInvitation(orgId, invId) {
    await hq.revokeInvitation(orgId, invId);
    set((state) => ({ invitations: state.invitations.filter((i) => i.id !== invId) }));
  },
}));
