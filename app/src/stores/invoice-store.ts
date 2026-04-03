import { create } from "zustand";
import { api } from "@/lib/api";

export interface Client {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly company: string | null;
}

export interface InvoiceLineItem {
  readonly description: string;
  readonly quantity: number;
  readonly rate: number;
  readonly amount: number;
}

export interface Invoice {
  readonly id: string;
  readonly client_id: string;
  readonly client_name: string;
  readonly number: string;
  readonly status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  readonly items: readonly InvoiceLineItem[];
  readonly total: number;
  readonly due_date: string;
  readonly issued_at: string;
}

interface InvoiceState {
  invoices: readonly Invoice[];
  clients: readonly Client[];
  loading: boolean;
  error: string | null;
  loadInvoices: () => Promise<void>;
  loadClients: () => Promise<void>;
  createInvoice: (data: Omit<Invoice, "id" | "number" | "client_name" | "issued_at">) => Promise<void>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
  invoices: [],
  clients: [],
  loading: false,
  error: null,

  async loadInvoices() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ invoices: Invoice[] }>("/invoices");
      set({ invoices: data.invoices, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async loadClients() {
    try {
      const data = await api.get<{ clients: Client[] }>("/invoices/clients");
      set({ clients: data.clients });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  async createInvoice(data) {
    await api.post("/invoices", { invoice: data });
    const res = await api.get<{ invoices: Invoice[] }>("/invoices");
    set({ invoices: res.invoices });
  },

  async updateInvoice(id, data) {
    await api.patch(`/invoices/${id}`, { invoice: data });
    const res = await api.get<{ invoices: Invoice[] }>("/invoices");
    set({ invoices: res.invoices });
  },

  async deleteInvoice(id) {
    await api.delete(`/invoices/${id}`);
    set((s) => ({ invoices: s.invoices.filter((inv) => inv.id !== id) }));
  },
}));
