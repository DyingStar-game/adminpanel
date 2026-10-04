import { create } from 'zustand';
import type { Item } from '@dyingstar-admin/schemas';
import type { SpawnPreset } from '@/lib/spawn';

/** Write action in progress, shown by `ItemActionsHost` (one sheet or dialog at a time). */
export type ItemAction =
  | { kind: 'edit'; uuid: string }
  | {
      kind: 'create';
      parentId: string;
      objectType?: string | undefined;
      spawn?: SpawnContext;
      place?: PlaceContext;
    }
  | { kind: 'delete'; uuid: string }
  | { kind: 'duplicate'; uuid: string };

/**
 * Creation next to an entity: the entity itself (placement is recomputed from it when the
 * distance, height or type change), the initial placement, and its label for the UI.
 */
export interface SpawnContext {
  reference: Item;
  preset: SpawnPreset;
  nearLabel: string;
}

/** Creation at a fixed place (clicked on the map): position and orientation, and its label. */
export interface PlaceContext {
  preset: SpawnPreset;
  label: string;
}

interface ItemActionsState {
  action: ItemAction | null;
  edit: (uuid: string) => void;
  create: (context: {
    parentId: string;
    objectType?: string | undefined;
    spawn?: SpawnContext;
    place?: PlaceContext;
  }) => void;
  remove: (uuid: string) => void;
  duplicate: (uuid: string) => void;
  close: () => void;
}

export const useItemActions = create<ItemActionsState>()((set) => ({
  action: null,
  edit: (uuid) => set({ action: { kind: 'edit', uuid } }),
  create: (context) => set({ action: { kind: 'create', ...context } }),
  remove: (uuid) => set({ action: { kind: 'delete', uuid } }),
  duplicate: (uuid) => set({ action: { kind: 'duplicate', uuid } }),
  close: () => set({ action: null }),
}));
