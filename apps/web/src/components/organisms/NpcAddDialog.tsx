import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { MAX_BULK, MAX_CREATE } from '@dyingstar-admin/contracts/npc';
import { LabelledField } from '@/components/molecules/LabelledField';
import { OptionSelect } from '@/components/molecules/OptionSelect';
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
import { useBulkNpcs, useCreateNpcs } from '@/hooks/useNpcActions';
import {
  ADD_FORM_DEFAULTS,
  addRequests,
  AddFormSchema,
  NEW_ROLES,
  writeError,
  type AddForm,
  type NpcFormError,
} from '@/lib/npcs';

/**
 * Adds NPCs to the servers (ADR 0031): creates N new ones (generated names, a Keycloak account
 * each; spawned at once or not) and / or spawns N existing disabled ones, the oldest first.
 * Both counts are optional, one is needed. The service's partial failures are reported.
 */
export function NpcAddDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateNpcs();
  const bulk = useBulkNpcs();
  const form = useForm<AddForm>({
    resolver: zodResolver(AddFormSchema),
    defaultValues: ADD_FORM_DEFAULTS,
    mode: 'onChange',
  });
  const errors = form.formState.errors;
  const message = (field: keyof AddForm) => {
    const code = errors[field]?.message as NpcFormError | undefined;
    return code ? t(`npcs.errors.${code}`) : undefined;
  };

  const submit = form.handleSubmit(async (valid) => {
    const requests = addRequests(valid);
    try {
      if (requests.create) {
        const done = await create.mutateAsync(requests.create);
        toast.success(t('npcs.add.created', { count: done?.created.length ?? 0 }));
        for (const error of done?.errors ?? []) toast.error(error);
      }
      if (requests.spawn) {
        const done = await bulk.mutateAsync(requests.spawn);
        toast.success(t('npcs.add.spawned', { count: done?.affected.length ?? 0 }));
        for (const error of done?.errors ?? []) toast.error(error);
      }
      onClose();
    } catch (error) {
      toast.error(writeError(error, t('npcs.unavailable')));
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-120">
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('npcs.add.title')}</DialogTitle>
            <DialogDescription>{t('npcs.add.hint')}</DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
            <legend className="px-1 text-xs text-fg-3">{t('npcs.add.createLegend')}</legend>
            <div className="flex flex-wrap items-end gap-3">
              <LabelledField
                id="add-create"
                label={t('npcs.add.createCount', { max: MAX_CREATE })}
                error={message('create')}
                className="w-40"
              >
                <Input
                  id="add-create"
                  type="number"
                  min={1}
                  max={MAX_CREATE}
                  aria-invalid={!!errors.create}
                  aria-describedby="add-create-message"
                  {...form.register('create', { valueAsNumber: true })}
                />
              </LabelledField>
              <LabelledField id="add-role" label={t('npcs.fields.role')}>
                <Controller
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <OptionSelect<AddForm['role']>
                      size="default"
                      label={t('npcs.fields.role')}
                      value={field.value}
                      options={NEW_ROLES.map((r) => ({ value: r, label: t(`npcs.roles.${r}`) }))}
                      onChange={field.onChange}
                      className="w-40"
                    />
                  )}
                />
              </LabelledField>
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch id="add-enabled" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="add-enabled">{t('npcs.add.enabled')}</Label>
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
            <legend className="px-1 text-xs text-fg-3">{t('npcs.add.spawnLegend')}</legend>
            <LabelledField
              id="add-spawn"
              label={t('npcs.add.spawnCount')}
              hint={t('npcs.add.spawnHint')}
              error={message('spawn')}
              className="w-56"
            >
              <Input
                id="add-spawn"
                type="number"
                min={1}
                max={MAX_BULK}
                aria-invalid={!!errors.spawn}
                aria-describedby="add-spawn-message"
                {...form.register('spawn', { valueAsNumber: true })}
              />
            </LabelledField>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('confirm.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!form.formState.isValid || create.isPending || bulk.isPending}
            >
              {t('npcs.add.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
