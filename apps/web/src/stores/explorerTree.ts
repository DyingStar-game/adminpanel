import { create } from 'zustand';

/** Expanded nodes of the hierarchy tree: item UUIDs and `parentId|type` groups. */
interface ExplorerTreeState {
  expanded: Record<string, true>;
  toggle: (id: string) => void;
  expand: (ids: string[]) => void;
}

export const groupNodeId = (parentId: string, objectType: string) => `${parentId}|${objectType}`;

export const useExplorerTree = create<ExplorerTreeState>()((set) => ({
  expanded: {},
  toggle: (id) =>
    set(({ expanded }) => ({
      expanded: expanded[id]
        ? Object.fromEntries(Object.entries(expanded).filter(([key]) => key !== id))
        : { ...expanded, [id]: true },
    })),
  expand: (ids) =>
    set(({ expanded }) => ({
      expanded: { ...expanded, ...Object.fromEntries(ids.map((id) => [id, true])) },
    })),
}));
