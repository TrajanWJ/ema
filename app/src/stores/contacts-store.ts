import { create } from "zustand";
import { api } from "@/lib/api";

export type RelationshipType = "personal" | "professional" | "family" | "acquaintance";

export interface Contact {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly company: string | null;
  readonly role: string | null;
  readonly notes: string | null;
  readonly tags: readonly string[];
  readonly relationship_type: RelationshipType;
  readonly status: "active" | "archived";
  readonly inserted_at: string;
}

interface ContactsState {
  contacts: readonly Contact[];
  loading: boolean;
  error: string | null;
  loadViaRest: () => Promise<void>;
  createContact: (attrs: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    role?: string;
    notes?: string;
  }) => Promise<void>;
  updateContact: (
    id: string,
    attrs: Partial<Omit<Contact, "id" | "inserted_at">>,
  ) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
}

export const useContactsStore = create<ContactsState>((set) => ({
  contacts: [],
  loading: false,
  error: null,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ contacts: Contact[] }>("/contacts");
      set({ contacts: data.contacts, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async createContact(attrs) {
    await api.post<{ contact: Contact }>("/contacts", { contact: attrs });
    await useContactsStore.getState().loadViaRest();
  },

  async updateContact(id, attrs) {
    await api.put<{ contact: Contact }>(`/contacts/${id}`, {
      contact: attrs,
    });
    await useContactsStore.getState().loadViaRest();
  },

  async deleteContact(id) {
    await api.delete(`/contacts/${id}`);
    set((s) => ({
      contacts: s.contacts.filter((c) => c.id !== id),
    }));
  },
}));
