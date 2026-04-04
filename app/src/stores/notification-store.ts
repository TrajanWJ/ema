import { create } from "zustand";

export interface Toast {
  readonly id: string;
  readonly message: string;
  readonly variant: "success" | "error" | "info";
  readonly durationMs: number;
}

interface NotificationState {
  toasts: readonly Toast[];
  push: (message: string, variant?: Toast["variant"], durationMs?: number) => void;
  dismiss: (id: string) => void;
}

let nextId = 0;

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],

  push(message, variant = "info", durationMs = 5000) {
    const id = String(++nextId);
    const toast: Toast = { id, message, variant, durationMs };
    set((s) => ({ toasts: [...s.toasts, toast] }));

    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, durationMs);
  },

  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
