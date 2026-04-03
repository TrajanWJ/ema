import { create } from "zustand";
import { api } from "@/lib/api";

interface Contact {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly company: string | null;
  readonly role: string | null;
  readonly relationship_type: "personal" | "professional" | "family" | "acquaintance";
  readonly tags: readonly string[];
  readonly last_contact_at: string | null;
  readonly next_follow_up: string | null;
  readonly notes: string | null;
  readonly created_at: string;
}

interface Interaction {
  readonly id: string;
  readonly contact_id: string;
  readonly type: "meeting" | "call" | "email" | "message" | "note";
  readonly summary: string;
  readonly date: string;
}

interface ContactsState {
  contacts: readonly Contact[];
  interactions: readonly Interaction[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  loadContacts: () => Promise<void>;
  loadInteractions: (contactId: string) => Promise<void>;
  selectContact: (id: string | null) => void;
  createContact: (attrs: {
    name: string;
    email?: string;
    company?: string;
    role?: string;
    relationship_type: Contact["relationship_type"];
    tags?: string[];
    next_follow_up?: string;
  }) => Promise<void>;
  updateContact: (id: string, attrs: Partial<Omit<Contact, "id" | "created_at">>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  logInteraction: (attrs: {
    contact_id: string;
    type: Interaction["type"];
    summary: string;
    date: string;
  }) => Promise<void>;
}

export const useContactsStore = create<ContactsState>((set) => ({
  contacts: [],
  interactions: [],
  selectedId: null,
  loading: false,
  error: null,

  async loadContacts() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ contacts: Contact[] }>("/contacts");
      set({ contacts: data.contacts, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load contacts",
      });
    }
  },

  async loadInteractions(contactId) {
    try {
      const data = await api.get<{ interactions: Interaction[] }>(
        `/contacts/${contactId}/interactions`
      );
      set({ interactions: data.interactions });
    } catch (e) {
      console.warn("Failed to load interactions:", e);
    }
  },

  selectContact(id) {
    set({ selectedId: id, interactions: [] });
  },

  async createContact(attrs) {
    const created = await api.post<Contact>("/contacts", attrs);
    set((s) => ({ contacts: [...s.contacts, created] }));
  },

  async updateContact(id, attrs) {
    const updated = await api.put<Contact>(`/contacts/${id}`, attrs);
    set((s) => ({
      contacts: s.contacts.map((c) => (c.id === updated.id ? updated : c)),
    }));
  },

  async deleteContact(id) {
    await api.delete(`/contacts/${id}`);
    set((s) => ({
      contacts: s.contacts.filter((c) => c.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
  },

  async logInteraction(attrs) {
    const created = await api.post<Interaction>(
      `/contacts/${attrs.contact_id}/interactions`,
      attrs
    );
    set((s) => ({ interactions: [...s.interactions, created] }));
  },
}));
