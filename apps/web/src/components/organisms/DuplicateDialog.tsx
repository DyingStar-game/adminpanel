import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ErrorCode, UuidSchema, type Item, type Vec3 } from '@dyingstar-admin/schemas';
import { EntityPicker } from '@/components/molecules/EntityPicker';
import { PropertyInput } from '@/components/molecules/PropertyInput';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useChildrenCounts, useItem } from '@/hooks/queries';
import { useDuplicateItem } from '@/hooks/mutations';
import { useGoToItem } from '@/hooks/useGoToItem';
import { usePlayers } from '@/hooks/usePlayers';
import { useWriteTarget } from '@/hooks/useWriteTarget';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { itemLabel } from '@/lib/itemLabel';
import { isValidParentId, parseRaw, toRaw } from '@/lib/propertyForm';
import { spawnNextTo } from '@/lib/spawn';
import { usePreferences } from '@/stores/preferences';

interface DuplicateDialogProps {
  uuid: string;
  onDuplicated: (root: Item) => void;
  onCancel: () => void;
}

/** Target placement, as raw editable text (vectors as `x,y,z`). */
interface Placement {
  parentId: string;
  position: string;
  rotation: string;
  /** What the placement was computed from, shown to the user. */
  reference: string | null;
}

const placementFrom = (reference: Item): Placement | null => {
  const preset = spawnNextTo(reference);
  return preset
    ? {
        parentId: preset.parentId,
        position: toRaw(preset.position, 'vec3'),
        rotation: toRaw(preset.rotation, 'vec3'),
        reference: itemLabel(reference),
      }
    : null;
};

/**
 * Duplicates an item and its children (ADR 0017). The target placement (parent, position,
 * rotation) is explicit and editable; a reference entity (a player, the original, any item by
 * UUID) fills it: its parent, 2 m in front of it, its yaw.
 */
export function DuplicateDialog({ uuid, onDuplicated, onCancel }: DuplicateDialogProps) {
  const { t } = useTranslation();
  const source = useItem(uuid);
  const counts = useChildrenCounts(uuid);
  const { me, setMe } = usePreferences();
  const { players, isPending: playersLoading } = usePlayers();
  const goToItem = useGoToItem();
  const duplicate = useDuplicateItem();
  const { isProduction, server } = useWriteTarget();
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [withChildren, setWithChildren] = useState(true);
  const [referenceUuid, setReferenceUuid] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Until a reference is picked, the copy goes next to the original.
  const current = placement ?? (source.data ? placementFrom(source.data) : null);
  const update = (patch: Partial<Placement>) =>
    current &&
    setPlacement({ ...current, ...patch, reference: patch.reference ?? current.reference });
  const applyReference = (reference: Item) => {
    const next = placementFrom(reference);
    if (next) setPlacement(next);
    else setError(t('duplicate.noPosition', { label: itemLabel(reference) }));
  };

  const position = current ? parseRaw(current.position, 'vec3') : null;
  const rotation = current ? parseRaw(current.rotation, 'vec3') : null;
  const parentOk = !!current && isValidParentId(current.parentId);
  const valid = parentOk && !!position?.ok && !!rotation?.ok;
  const children = counts.data?.total ?? 0;

  const confirm = async () => {
    if (!current || !position?.ok || !rotation?.ok) return;
    setError(null);
    try {
      const created = await duplicate.mutateAsync({
        uuid,
        parent_id: current.parentId,
        position: position.value as Vec3,
        rotation: rotation.value as Vec3,
        children: withChildren,
      });
      toast.success(t('duplicate.done', { count: created.length }));
      const root = created[0];
      if (root) onDuplicated(root);
    } catch (e) {
      if (e instanceof ApiError && e.code === ErrorCode.duplicateTooLarge)
        setError(t('duplicate.tooLarge'));
      else setError(e instanceof Error ? e.message : t('editor.failed'));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {t('duplicate.title', { label: source.data ? itemLabel(source.data) : '…' })}
          </DialogTitle>
          <DialogDescription>{t('duplicate.body')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          <section aria-label={t('duplicate.reference')} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">{t('duplicate.reference')}</span>
            <EntityPicker
              value={me}
              onChange={(id) => {
                setMe(id);
                const player = players.find((p) => p.object_uuid === id);
                if (player) applyReference(player);
              }}
              options={players.map((p) => ({
                uuid: p.object_uuid,
                label: itemLabel(p),
                objectType: 'player',
                hint: p.object_data.is_npc === true ? t('duplicate.npc') : undefined,
              }))}
              labels={{
                field: t('duplicate.pickPlayer'),
                empty: playersLoading ? t('inspector.loading') : t('duplicate.noPlayer'),
              }}
            />
            <div className="flex gap-1.5">
              <Input
                value={referenceUuid}
                onChange={(e) => setReferenceUuid(e.target.value.trim())}
                placeholder={t('duplicate.referenceUuid')}
                aria-label={t('duplicate.referenceUuid')}
                className="h-8 font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!UuidSchema.safeParse(referenceUuid).success}
                onClick={() =>
                  void goToItem(referenceUuid).then((item) =>
                    item
                      ? applyReference(item)
                      : setError(t('explorer.notFound', { uuid: referenceUuid })),
                  )
                }
              >
                {t('duplicate.use')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!source.data}
                onClick={() => source.data && applyReference(source.data)}
              >
                {t('duplicate.theOriginal')}
              </Button>
            </div>
          </section>

          <section
            aria-label={t('duplicate.placementTitle')}
            className="flex flex-col gap-2 rounded-md border p-3"
          >
            <span className="text-xs font-medium">
              {t('duplicate.placementTitle')}
              {current?.reference && (
                <span className="font-normal text-fg-3">
                  {' '}
                  · {t('duplicate.from', { label: current.reference })}
                </span>
              )}
            </span>
            <div className="flex flex-col gap-1">
              <Label htmlFor="duplicate-parent" className="font-mono text-[11px]">
                parent_id
              </Label>
              <Input
                id="duplicate-parent"
                value={current?.parentId ?? ''}
                onChange={(e) => update({ parentId: e.target.value.trim() })}
                aria-invalid={!parentOk}
                className={cn('h-8 font-mono text-xs', !parentOk && 'border-destructive')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[11px]">position</span>
              <PropertyInput
                id="duplicate-position"
                label="position"
                kind="vec3"
                value={current?.position ?? '0,0,0'}
                onChange={(value) => update({ position: value })}
                invalid={!position?.ok}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[11px]">rotation</span>
              <PropertyInput
                id="duplicate-rotation"
                label="rotation"
                kind="vec3"
                value={current?.rotation ?? '0,0,0'}
                onChange={(value) => update({ rotation: value })}
                invalid={!rotation?.ok}
              />
            </div>
            <p className="text-[11px] text-fg-3">{t('duplicate.relative')}</p>
          </section>

          <div className="flex items-center gap-2">
            <Switch
              id="duplicate-children"
              checked={withChildren}
              onCheckedChange={setWithChildren}
            />
            <Label htmlFor="duplicate-children" className="font-normal">
              {t('duplicate.children', { count: children })}
            </Label>
          </div>
          <p className="text-xs text-fg-2">{t('duplicate.cleared')}</p>
          {isProduction && (
            <p className="font-medium">
              {t('editor.productionBody', { server: server?.name ?? '' })}
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('confirm.cancel')}
          </Button>
          <Button
            disabled={!valid || duplicate.isPending}
            onClick={() => void confirm()}
            className={cn(isProduction && 'bg-destructive text-white hover:bg-destructive/90')}
          >
            {t('duplicate.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
