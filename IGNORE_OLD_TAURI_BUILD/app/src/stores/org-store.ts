import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Organization, OrgMember, OrgInvitation } from "@/types/org";

interface OrgState {
  orgs: readonly Organization[];
  activeOrg: Organization | null;
  members: readonly OrgMember[];
  invitations: readonly OrgInvitation[];
  loaded: boolean;
  connected: boolean;
  channel: Channel | null;
  orgChannel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  connectToOrg: (orgId: string) => Promise<void>;
  setActiveOrg: (org: Organization | null) => void;
  createOrg: (data: Partial<Organization>) => Promise<Organization>;
  updateOrg: (id: string, data: Partial<Organization>) => Promise<void>;
  deleteOrg: (id: string) => Promise<void>;
  createInvitation: (orgId: string, data: { role?: string; expires_at?: string; max_uses?: number }) => Promise<{ invitation: OrgInvitation; link: string }>;
  revokeInvitation: (orgId: string, invId: string) => Promise<void>;
  joinViaToken: (token: string, data: { display_name: string; email?: string }) => Promise<{ member: OrgMember; org: Organization }>;
  previewInvitation: (token: string) => Promise<{ org_name: string; org_description: string | null; role: string; expires_at: string | null }>;
  removeMember: (orgId: string, memberId: string) => Promise<void>;
  updateRole: (orgId: string, memberId: string, role: string) => Promise<void>;
  loadOrgDetail: (id: string) => Promise<void>;
}

export const useOrgStore = create<OrgState>((set, get) => ({
  orgs: [],
  activeOrg: null,
  members: [],
  invitations: [],
  loaded: false,
  connected: false,
  channel: null,
  orgChannel: null,

  async loadViaRest() {
    const data = await api.get<{ orgs: Organization[] }>("/orgs");
    set({ orgs: data.orgs, loaded: true });
  },

  async connect() {
    const { channel, response } = await joinChannel("orgs:lobby");
    const data = response as { orgs: Organization[] };
    set({ channel, connected: true, orgs: data.orgs });

    channel.on("org_created", (org: Organization) => {
      set((s) => ({ orgs: [org, ...s.orgs] }));
    });

    channel.on("org_deleted", (payload: { id: string }) => {
      set((s) => ({
        orgs: s.orgs.filter((o) => o.id !== payload.id),
        activeOrg: s.activeOrg?.id === payload.id ? null : s.activeOrg,
      }));
    });
  },

  async connectToOrg(orgId: string) {
    const prev = get().orgChannel;
    if (prev) prev.leave();

    const { channel, response } = await joinChannel(`orgs:${orgId}`);
    const data = response as { org: Organization; members: OrgMember[] };
    set({ orgChannel: channel, members: data.members });

    channel.on("org_updated", (org: Organization) => {
      set((s) => ({
        activeOrg: s.activeOrg?.id === org.id ? org : s.activeOrg,
        orgs: s.orgs.map((o) => (o.id === org.id ? org : o)),
      }));
    });

    channel.on("member_joined", (member: OrgMember) => {
      set((s) => ({ members: [...s.members, member] }));
    });

    channel.on("member_removed", (payload: { id: string }) => {
      set((s) => ({ members: s.members.filter((m) => m.id !== payload.id) }));
    });

    channel.on("member_updated", (member: OrgMember) => {
      set((s) => ({
        members: s.members.map((m) => (m.id === member.id ? member : m)),
      }));
    });

    channel.on("invitation_created", (inv: OrgInvitation) => {
      set((s) => ({ invitations: [inv, ...s.invitations] }));
    });
  },

  setActiveOrg(org) {
    set({ activeOrg: org, members: [], invitations: [] });
    if (org) {
      get().connectToOrg(org.id).catch(() => {
        console.warn("Org channel connection failed");
      });
      get().loadOrgDetail(org.id).catch(() => {});
    }
  },

  async loadOrgDetail(id: string) {
    const data = await api.get<{
      org: Organization;
      members: OrgMember[];
      invitations: OrgInvitation[];
    }>(`/orgs/${id}`);
    set({ members: data.members, invitations: data.invitations });
  },

  async createOrg(data) {
    const org = await api.post<Organization>("/orgs", data);
    return org;
  },

  async updateOrg(id, data) {
    await api.put(`/orgs/${id}`, data);
  },

  async deleteOrg(id) {
    await api.delete(`/orgs/${id}`);
  },

  async createInvitation(orgId, data) {
    return api.post<{ invitation: OrgInvitation; link: string }>(
      `/orgs/${orgId}/invitations`,
      data
    );
  },

  async revokeInvitation(orgId, invId) {
    await api.delete(`/orgs/${orgId}/invitations/${invId}`);
    set((s) => ({ invitations: s.invitations.filter((i) => i.id !== invId) }));
  },

  async joinViaToken(token, data) {
    return api.post<{ member: OrgMember; org: Organization }>(`/join/${token}`, data);
  },

  async previewInvitation(token) {
    return api.get<{
      org_name: string;
      org_description: string | null;
      role: string;
      expires_at: string | null;
    }>(`/join/${token}/preview`);
  },

  async removeMember(orgId, memberId) {
    await api.delete(`/orgs/${orgId}/members/${memberId}`);
  },

  async updateRole(orgId, memberId, role) {
    await api.put(`/orgs/${orgId}/members/${memberId}/role`, { role });
  },
}));
