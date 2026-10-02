import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ItemSchema, type Item, type UpdateItemRequest } from '@dyingstar-admin/schemas';
import { apiSend } from '@/lib/api';
import { usePreferences } from '@/stores/preferences';

/** Data that a write may affect: refreshed right after it (lists, counts, ancestors, the item). */
const AFFECTED = ['item', 'items', 'items-infinite', 'children-counts', 'ancestors'];

function useAfterWrite() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(AFFECTED.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

const itemPath = (uuid: string) => `/api/items/${encodeURIComponent(uuid)}`;

/** `POST /api/items` — 409 `ALREADY_EXISTS` when the UUID is taken (ADR 0004). */
export function useCreateItem() {
  const serverId = usePreferences((s) => s.serverId);
  const afterWrite = useAfterWrite();
  return useMutation({
    mutationFn: async (item: Item) =>
      (await apiSend('POST', '/api/items', { serverId, body: item, schema: ItemSchema })) as Item,
    onSuccess: afterWrite,
  });
}

/** `PUT /api/items/:uuid` with merge-on-save — 409 `EDIT_CONFLICT` with details (ADR 0009). */
export function useUpdateItem() {
  const serverId = usePreferences((s) => s.serverId);
  const afterWrite = useAfterWrite();
  return useMutation({
    mutationFn: async ({ uuid, ...body }: UpdateItemRequest & { uuid: string }) =>
      (await apiSend('PUT', itemPath(uuid), { serverId, body, schema: ItemSchema })) as Item,
    onSuccess: afterWrite,
  });
}

/** `DELETE /api/items/:uuid` — children are not deleted, the game is not notified (ADR 0003). */
export function useDeleteItem() {
  const serverId = usePreferences((s) => s.serverId);
  const afterWrite = useAfterWrite();
  return useMutation({
    mutationFn: async (uuid: string) => {
      await apiSend('DELETE', itemPath(uuid), { serverId });
    },
    onSuccess: afterWrite,
  });
}
