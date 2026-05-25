import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Plus } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TruncatedUuid,
  Modal,
  Spinner,
} from '@/components/ui';
import { apiFetch } from '@/lib/api';
import type { ItemResponse, PaginatedItemsResponse } from '@dyingstar/shared';
import { useServerId } from '@/hooks/useApi';
import { ItemFormPanel } from '@/components/items/ItemFormPanel';
import { toast } from '@/stores/toastStore';
import { useI18n } from '@/hooks/useI18n';

/** Paginated CRUD table for game items on the active server. */
export function ItemsPage() {
  const { t } = useI18n();
  const serverId = useServerId();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [objectType, setObjectType] = useState('');
  const [scenename, setScenename] = useState('');
  const [parentId, setParentId] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editItem, setEditItem] = useState<ItemResponse | undefined>();
  const [deleteUuid, setDeleteUuid] = useState<string | null>(null);

  const queryKey = ['items', serverId, page, objectType, scenename, parentId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        page_size: '20',
      });
      if (objectType) qs.set('object_type', objectType);
      if (scenename) qs.set('scenename', scenename);
      if (parentId) qs.set('parent_id', parentId);
      return apiFetch<PaginatedItemsResponse>(`/api/items?${qs}`, { serverId });
    },
    enabled: Boolean(serverId),
  });

  const deleteMutation = useMutation({
    mutationFn: (uuid: string) =>
      apiFetch(`/api/items/${uuid}`, { method: 'DELETE', serverId }),
    onSuccess: () => {
      toast.success(t('toast.itemDeleted'));
      qc.invalidateQueries({ queryKey: ['items'] });
      setDeleteUuid(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  /** Opens the form panel in create mode. */
  const openCreate = () => {
    setEditItem(undefined);
    setPanelOpen(true);
  };

  /** Opens the form panel prefilled for the given item. */
  const openEdit = (item: ItemResponse) => {
    setEditItem(item);
    setPanelOpen(true);
  };

  if (!serverId) {
    return <p className="text-ds-muted">{t('common.noServer')}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ds-text">{t('items.title')}</h1>
        <Button onClick={openCreate}>
          <Plus size={16} strokeWidth={1.5} />
          {t('items.add')}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label>object_type</Label>
              <Input
                value={objectType}
                onChange={(e) => {
                  setObjectType(e.target.value);
                  setPage(1);
                }}
                placeholder="Filtrer par type"
              />
            </div>
            <div>
              <Label>scenename</Label>
              <Input
                value={scenename}
                onChange={(e) => {
                  setScenename(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <Label>parent_id</Label>
              <Input
                value={parentId}
                onChange={(e) => {
                  setParentId(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>object_type</TableHeader>
                    <TableHeader>object_uuid</TableHeader>
                    <TableHeader>name</TableHeader>
                    <TableHeader>parent_id</TableHeader>
                    <TableHeader>scenename</TableHeader>
                    <TableHeader>Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <tbody>
                  {(data?.items ?? []).map((item) => (
                    <TableRow key={item.object_uuid}>
                      <TableCell>{item.object_type}</TableCell>
                      <TableCell>
                        <TruncatedUuid uuid={item.object_uuid} />
                      </TableCell>
                      <TableCell>{String(item.object_data.name ?? '—')}</TableCell>
                      <TableCell className="font-mono text-xs text-ds-muted">
                        {String(item.object_data.parent_id ?? '—')}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {String(item.object_data.scenename ?? '—')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(item)}
                            className="text-ds-muted hover:text-ds-text"
                          >
                            <Pencil size={16} strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => setDeleteUuid(item.object_uuid)}
                            className="text-ds-muted hover:text-ds-danger"
                          >
                            <Trash2 size={16} strokeWidth={1.5} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>

              <div className="flex items-center justify-between mt-4 text-sm text-ds-muted">
                <span>
                  Page {page} / {totalPages} — {data?.total ?? 0} items
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ItemFormPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        item={editItem}
        onSaved={() => qc.invalidateQueries({ queryKey: ['items'] })}
      />

      <Modal
        open={Boolean(deleteUuid)}
        onClose={() => setDeleteUuid(null)}
        title="Confirmer la suppression"
      >
        <p className="text-sm text-ds-muted mb-4">Cette action est irréversible.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteUuid(null)}>
            Annuler
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteUuid && deleteMutation.mutate(deleteUuid)}
          >
            Supprimer
          </Button>
        </div>
      </Modal>
    </div>
  );
}
