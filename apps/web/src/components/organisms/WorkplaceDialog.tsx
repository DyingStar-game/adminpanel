import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Workplace } from '@dyingstar-admin/contracts/npc';
import { LabelledField } from '@/components/molecules/LabelledField';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
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
import { useDeleteWorkplace, useSetWorkplace } from '@/hooks/useNpcActions';
import { writeError, type NpcFormError } from '@/lib/npcs';

/** A persistence UUID, as the contract takes it (hex groups, no RFC version bits). */
const HEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WorkplaceFormSchema = z.object({
  warehouseId: z.string().trim().regex(HEX_UUID, { error: 'uuid' }),
  warehouseCode: z.string().trim().max(64, { error: 'tooLong' }),
  scenename: z.string().trim().max(256, { error: 'tooLong' }),
});
type WorkplaceForm = z.infer<typeof WorkplaceFormSchema>;

interface WorkplaceDialogProps {
  village: string;
  workplace: Workplace | null;
  onClose: () => void;
}

/**
 * Sets by hand the cargo depot a mining village's storekeepers work at (ADR 0026): a
 * persistence UUID, with its code and scene when known; it wins over the automatic sources
 * (universesimulator, the world data). Clearing it lets the next assignment resolve it again.
 */
export function WorkplaceDialog({ village, workplace, onClose }: WorkplaceDialogProps) {
  const { t } = useTranslation();
  const set = useSetWorkplace();
  const remove = useDeleteWorkplace();
  const [clearing, setClearing] = useState(false);
  const form = useForm<WorkplaceForm>({
    resolver: zodResolver(WorkplaceFormSchema),
    defaultValues: {
      warehouseId: workplace?.warehouseId ?? '',
      warehouseCode: workplace?.warehouseCode ?? '',
      scenename: workplace?.scenename ?? '',
    },
    mode: 'onChange',
  });
  const errors = form.formState.errors;
  const message = (field: keyof WorkplaceForm) => {
    const code = errors[field]?.message as NpcFormError | undefined;
    return code ? t(`npcs.errors.${code}`) : undefined;
  };

  const submit = form.handleSubmit(async (valid) => {
    try {
      await set.mutateAsync({
        code: village,
        body: {
          warehouseId: valid.warehouseId,
          ...(valid.warehouseCode ? { warehouseCode: valid.warehouseCode } : {}),
          ...(valid.scenename ? { scenename: valid.scenename } : {}),
        },
      });
      toast.success(t('npcs.villages.workplaceSet', { village }));
      onClose();
    } catch (error) {
      toast.error(writeError(error, t('npcs.unavailable')));
    }
  });

  const clear = async () => {
    setClearing(false);
    try {
      await remove.mutateAsync(village);
      toast.success(t('npcs.villages.workplaceCleared', { village }));
      onClose();
    } catch (error) {
      toast.error(writeError(error, t('npcs.unavailable')));
    }
  };

  if (clearing) {
    return (
      <WriteConfirm
        open
        destructive
        title={t('npcs.villages.clearTitle', { village })}
        description={<p>{t('npcs.villages.clearText')}</p>}
        confirmLabel={t('npcs.villages.clear')}
        cancelLabel={t('confirm.cancel')}
        onConfirm={() => void clear()}
        onCancel={() => setClearing(false)}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-120">
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('npcs.villages.workplaceTitle', { village })}</DialogTitle>
            <DialogDescription>{t('npcs.villages.workplaceHint')}</DialogDescription>
          </DialogHeader>
          <LabelledField
            id="workplace-id"
            label={t('npcs.villages.warehouseId')}
            error={message('warehouseId')}
          >
            <Input
              id="workplace-id"
              className="font-mono text-xs"
              aria-invalid={!!errors.warehouseId}
              aria-describedby="workplace-id-message"
              {...form.register('warehouseId')}
            />
          </LabelledField>
          <div className="flex flex-wrap gap-3">
            <LabelledField
              id="workplace-code"
              label={t('npcs.villages.warehouseCode')}
              error={message('warehouseCode')}
              className="w-40"
            >
              <Input
                id="workplace-code"
                aria-describedby="workplace-code-message"
                {...form.register('warehouseCode')}
              />
            </LabelledField>
            <LabelledField
              id="workplace-scene"
              label={t('npcs.villages.scenename')}
              error={message('scenename')}
              className="min-w-48 flex-1"
            >
              <Input
                id="workplace-scene"
                aria-describedby="workplace-scene-message"
                {...form.register('scenename')}
              />
            </LabelledField>
          </div>
          <DialogFooter>
            {workplace && (
              <Button
                type="button"
                variant="destructive"
                className="mr-auto"
                onClick={() => setClearing(true)}
              >
                {t('npcs.villages.clear')}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              {t('confirm.cancel')}
            </Button>
            <Button type="submit" disabled={!form.formState.isValid || set.isPending}>
              {t('npcs.villages.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
