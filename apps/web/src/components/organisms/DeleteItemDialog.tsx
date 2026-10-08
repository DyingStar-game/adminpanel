import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Item } from '@dyingstar-admin/schemas';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { useChildrenCounts, useItem } from '@/hooks/queries';
import { useDeleteItem } from '@/hooks/mutations';
import { useWriteTarget } from '@/hooks/useWriteTarget';
import { itemLabel } from '@/lib/itemLabel';

interface DeleteItemDialogProps {
  uuid: string;
  onDeleted: (item: Item) => void;
  onCancel: () => void;
}

/**
 * Deletion with its consequences spelled out (ADR 0003, 0005): children are not deleted and
 * become orphans, and the service does not notify the running game.
 */
export function DeleteItemDialog({ uuid, onDeleted, onCancel }: DeleteItemDialogProps) {
  const { t } = useTranslation();
  const item = useItem(uuid);
  const counts = useChildrenCounts(uuid);
  const remove = useDeleteItem();
  const { isProduction, serverName } = useWriteTarget();
  const children = counts.data?.total ?? 0;

  if (!item.data) return null;
  const target = item.data;

  return (
    <WriteConfirm
      open
      destructive
      title={t('editor.deleteTitle', { label: itemLabel(target) })}
      description={
        <>
          <p>{t('editor.deleteBody', { type: target.object_type, uuid: target.object_uuid })}</p>
          {children > 0 && (
            <p className="font-medium text-destructive">
              {t('editor.deleteOrphans', { count: children })}
            </p>
          )}
          <p>{t('editor.deleteNotPropagated')}</p>
          {isProduction && (
            <p className="font-medium">{t('editor.productionBody', { server: serverName })}</p>
          )}
        </>
      }
      confirmLabel={t('editor.delete')}
      cancelLabel={t('confirm.cancel')}
      // Confirming closes the dialog, which unmounts it: `mutate` callbacks would be dropped,
      // so the deletion is awaited instead.
      onConfirm={() => {
        remove
          .mutateAsync(uuid)
          .then(() => {
            toast.success(t('editor.deleted', { label: itemLabel(target) }));
            onDeleted(target);
          })
          .catch((error: unknown) =>
            toast.error(error instanceof Error ? error.message : t('editor.failed')),
          );
      }}
      onCancel={onCancel}
    />
  );
}
