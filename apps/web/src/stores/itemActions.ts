import { create } from 'zustand';

/** Write action in progress, shown by `ItemActionsHost` (one sheet or dialog at a time). */
export type ItemAction =
  | { kind: 'edit'; uuid: string }
  | { kind: 'create'; parentId: string; objectType?: string | undefined }
  | { kind: 'delete'; uuid: string };

interface ItemActionsState {
  action: ItemAction | null;
  edit: (uuid: string) => void;
  create: (context: { parentId: string; objectType?: string | undefined }) => void;
  remove: (uuid: string) => void;
  close: () => void;
}

export const useItemActions = create<ItemActionsState>()((set) => ({
  action: null,
  edit: (uuid) => set({ action: { kind: 'edit', uuid } }),
  create: (context) => set({ action: { kind: 'create', ...context } }),
  remove: (uuid) => set({ action: { kind: 'delete', uuid } }),
  close: () => set({ action: null }),
}));
