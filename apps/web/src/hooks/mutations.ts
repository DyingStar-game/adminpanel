import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DuplicateResponseSchema,
  ItemSchema,
  type DuplicateRequest,
  type Item,
  type UpdateItemRequest,
} from '@dyingstar-admin/schemas';
import { apiSend } from '@/lib/api';

/** Data that a write may affect: refreshed right after it (lists, counts, ancestors, the item). */
const AFFECTED = ['item', 'items', 'items-infinite', 'children-counts', 'ancestors', 'body-map'];

export function useAfterWrite() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(AFFECTED.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
}

const itemPath = (uuid: string) => `/api/items/${encodeURIComponent(uuid)}`;

/** `POST /api/items` — 409 `ALREADY_EXISTS` when the UUID is taken (ADR 0004). */
export function useCreateItem() {
  const afterWrite = useAfterWrite();
  return useMutation({
    mutationFn: async (item: Item) =>
      (await apiSend('POST', '/api/items', { body: item, schema: ItemSchema })) as Item,
    onSuccess: afterWrite,
  });
}

/** `PUT /api/items/:uuid` with merge-on-save — 409 `EDIT_CONFLICT` with details (ADR 0009). */
export function useUpdateItem() {
  const afterWrite = useAfterWrite();
  return useMutation({
    mutationFn: async ({ uuid, ...body }: UpdateItemRequest & { uuid: string }) =>
      (await apiSend('PUT', itemPath(uuid), { body, schema: ItemSchema })) as Item,
    onSuccess: afterWrite,
  });
}

/** `DELETE /api/items/:uuid` — children are not deleted, the game is not notified (ADR 0003). */
export function useDeleteItem() {
  const afterWrite = useAfterWrite();
  return useMutation({
    mutationFn: async (uuid: string) => {
      await apiSend('DELETE', itemPath(uuid));
    },
    onSuccess: afterWrite,
  });
}

/** `POST /api/items/:uuid/duplicate` — copies the item and its children (ADR 0017). */
export function useDuplicateItem() {
  const afterWrite = useAfterWrite();
  return useMutation({
    mutationFn: async ({ uuid, ...body }: DuplicateRequest & { uuid: string }) => {
      const res = await apiSend('POST', `${itemPath(uuid)}/duplicate`, {
        body,
        schema: DuplicateResponseSchema,
      });
      return res?.created ?? [];
    },
    onSuccess: afterWrite,
  });
}
