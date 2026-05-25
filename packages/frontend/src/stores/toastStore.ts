import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

/** A single transient notification shown in the toast container. */
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

/** In-memory store for stacked toast notifications (auto-dismiss after 4s). */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  /** Appends a toast and schedules automatic removal. */
  addToast: (type, message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  /** Removes a toast by id (e.g. user dismissed). */
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helpers to show success, error, or info toasts outside React. */
export const toast = {
  /** Shows a success toast. */
  success: (m: string) => useToastStore.getState().addToast('success', m),
  /** Shows an error toast. */
  error: (m: string) => useToastStore.getState().addToast('error', m),
  /** Shows an info toast. */
  info: (m: string) => useToastStore.getState().addToast('info', m),
};
