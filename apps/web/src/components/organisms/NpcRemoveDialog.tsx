import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { MAX_BULK, type PanelBulk } from '@dyingstar-admin/contracts/npc';
import { LabelledField } from '@/components/molecules/LabelledField';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { TypedConfirmDialog } from '@/components/molecules/TypedConfirmDialog';
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
import { useBulkNpcs } from '@/hooks/useNpcActions';
import {
  removeRequest,
  RemoveFormSchema,
  writeError,
  type NpcFormError,
  type RemoveForm,
} from '@/lib/npcs';

interface NpcRemoveDialogProps {
  /** The rows selected in the roster: the default target when there are some. */
  selected: { id: string; displayName: string }[];
  onClose: () => void;
  /** After the removal (the selection is then cleared). */
  onDone: () => void;
}

/**
 * Removes NPCs from the servers (ADR 0031): despawns them (they stay in the roster, disabled)
 * or deletes them (runtime, Keycloak account and row, for good), either the rows selected or a
 * count picked by the service (the most recent enabled ones, storekeepers last), optionally in
 * one village. A deletion needs a typed confirmation.
 */
export function NpcRemoveDialog({ selected, onClose, onDone }: NpcRemoveDialogProps) {
  const { t } = useTranslation();
  const bulk = useBulkNpcs();
  const [confirming, setConfirming] = useState<PanelBulk | null>(null);
  const form = useForm<RemoveForm>({
    resolver: zodResolver(RemoveFormSchema),
    defaultValues: {
      action: 'despawn',
      scope: selected.length ? 'selected' : 'count',
      count: Number.NaN,
      village: '',
    },
    mode: 'onChange',
  });
  const values = useWatch({ control: form.control }) as RemoveForm;
  const errors = form.formState.errors;
  const message = (field: keyof RemoveForm) => {
    const code = errors[field]?.message as NpcFormError | undefined;
    return code ? t(`npcs.errors.${code}`) : undefined;
  };

  const run = async (request: PanelBulk) => {
    try {
      const done = await bulk.mutateAsync(request);
      toast.success(
        t(request.action === 'delete' ? 'npcs.remove.deleted' : 'npcs.remove.despawned', {
          count: done?.affected.length ?? 0,
        }),
      );
      for (const error of done?.errors ?? []) toast.error(error);
      onDone();
      onClose();
    } catch (error) {
      toast.error(writeError(error, t('npcs.unavailable')));
      setConfirming(null);
    }
  };

  const submit = form.handleSubmit(async (valid) => {
    const request = removeRequest(
      valid,
      selected.map((s) => s.id),
    );
    if (request.action === 'delete') setConfirming(request);
    else await run(request);
  });

  const target =
    values.scope === 'selected'
      ? t('npcs.remove.selectedTarget', { count: selected.length })
      : t('npcs.remove.countTarget', { count: Number.isNaN(values.count) ? 0 : values.count });

  if (confirming) {
    return (
      <TypedConfirmDialog
        title={t('npcs.remove.deleteTitle')}
        description={
          <>
            <p>{t('npcs.remove.deleteText', { target })}</p>
            {values.scope === 'selected' && (
              <p className="text-xs text-fg-3">{selected.map((s) => s.displayName).join(', ')}</p>
            )}
          </>
        }
        word={t('npcs.remove.word')}
        prompt={t('npcs.remove.typePrompt', { word: t('npcs.remove.word') })}
        confirmLabel={t('npcs.remove.delete')}
        cancelLabel={t('confirm.cancel')}
        pending={bulk.isPending}
        onConfirm={() => void run(confirming)}
        onCancel={() => setConfirming(null)}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-120">
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('npcs.remove.title')}</DialogTitle>
            <DialogDescription>{t('npcs.remove.hint')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-3">
            <LabelledField id="remove-action" label={t('npcs.remove.action')}>
              <Controller
                control={form.control}
                name="action"
                render={({ field }) => (
                  <OptionSelect<RemoveForm['action']>
                    size="default"
                    label={t('npcs.remove.action')}
                    value={field.value}
                    options={[
                      { value: 'despawn', label: t('npcs.remove.actions.despawn') },
                      { value: 'delete', label: t('npcs.remove.actions.delete') },
                    ]}
                    onChange={field.onChange}
                    className="w-48"
                  />
                )}
              />
            </LabelledField>
            <LabelledField id="remove-scope" label={t('npcs.remove.scope')}>
              <Controller
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <OptionSelect<RemoveForm['scope']>
                    size="default"
                    label={t('npcs.remove.scope')}
                    value={field.value}
                    options={[
                      ...(selected.length
                        ? [
                            {
                              value: 'selected' as const,
                              label: t('npcs.remove.scopes.selected', { count: selected.length }),
                            },
                          ]
                        : []),
                      { value: 'count', label: t('npcs.remove.scopes.count') },
                    ]}
                    onChange={(v) => {
                      field.onChange(v);
                      void form.trigger();
                    }}
                    className="w-56"
                  />
                )}
              />
            </LabelledField>
          </div>
          {values.scope === 'count' && (
            <div className="flex flex-wrap gap-3">
              <LabelledField
                id="remove-count"
                label={t('npcs.remove.count')}
                hint={t('npcs.remove.countHint')}
                error={message('count')}
                className="w-56"
              >
                <Input
                  id="remove-count"
                  type="number"
                  min={1}
                  max={MAX_BULK}
                  aria-invalid={!!errors.count}
                  aria-describedby="remove-count-message"
                  {...form.register('count', { valueAsNumber: true })}
                />
              </LabelledField>
              <LabelledField
                id="remove-village"
                label={t('npcs.remove.village')}
                hint={t('npcs.remove.villageHint')}
                error={message('village')}
                className="w-40"
              >
                <Input
                  id="remove-village"
                  placeholder="M0012"
                  aria-describedby="remove-village-message"
                  {...form.register('village')}
                />
              </LabelledField>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('confirm.cancel')}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!form.formState.isValid || bulk.isPending}
            >
              {values.action === 'delete'
                ? t('npcs.remove.continueDelete', { target })
                : t('npcs.remove.despawn', { target })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
