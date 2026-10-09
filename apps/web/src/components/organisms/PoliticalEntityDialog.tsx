import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  zPoliticalEntityType,
  type PoliticalEntity,
  type PoliticalEntityType,
} from '@dyingstar-admin/contracts/social';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { TwoStepDialog } from '@/components/molecules/TwoStepDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreatePoliticalEntity, useUpdatePoliticalEntity } from '@/hooks/useOrganisationActions';
import { ApiError } from '@/lib/api';
import { ProfilePicker } from './ProfilePicker';

const DESCRIPTION_MAX = 2000;

/** The form, within the contract's limits (`InternalCreatePoliticalEntity`, its patch). */
const PoliticalFormSchema = z.object({
  type: zPoliticalEntityType,
  name: z.string().trim().min(3).max(64),
  description: z.string().trim().max(DESCRIPTION_MAX),
  /** Creation only: the head, a player or an NPC. */
  headId: z.string(),
});
type PoliticalForm = z.infer<typeof PoliticalFormSchema>;

interface PoliticalEntityDialogProps {
  /** The entity to edit; none creates one. */
  entity?: PoliticalEntity;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

/**
 * Creates a political entity with its head, or edits one (ADR 0024 step N): the form, then a
 * summary to confirm. Its level is chosen at creation only, as `social` allows.
 */
export function PoliticalEntityDialog({ entity, onClose, onCreated }: PoliticalEntityDialogProps) {
  const { t } = useTranslation();
  const create = useCreatePoliticalEntity();
  const update = useUpdatePoliticalEntity(entity?.id ?? '');
  const editing = entity !== undefined;
  const form = useForm<PoliticalForm>({
    resolver: zodResolver(
      editing ? PoliticalFormSchema : PoliticalFormSchema.extend({ headId: z.uuid() }),
    ),
    defaultValues: {
      type: entity?.type ?? 'commune',
      name: entity?.name ?? '',
      description: entity?.description ?? '',
      headId: '',
    },
    mode: 'onChange',
  });
  const [type, name] = useWatch({ control: form.control, name: ['type', 'name'] });
  const [confirming, setConfirming] = useState(false);
  const levels = zPoliticalEntityType.options;

  const submit = form.handleSubmit(async ({ type: level, name: newName, description, headId }) => {
    try {
      if (entity) {
        await update.mutateAsync({ name: newName, description: description || null });
        toast.success(t('organisations.manage.saved', { name: newName }));
      } else {
        const created = await create.mutateAsync({
          type: level,
          name: newName,
          description: description || null,
          headId,
        });
        toast.success(t('organisations.manage.created', { name: newName }));
        if (created) onCreated?.(created.id);
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
      setConfirming(false);
    }
  });

  return (
    <TwoStepDialog
      title={
        entity
          ? t('organisations.manage.editTitle', { name: entity.name })
          : t('organisations.manage.createPolitical')
      }
      description={t('organisations.manage.hint')}
      confirming={confirming}
      summary={t('organisations.manage.politicalSummary', {
        name: name.trim(),
        level: t(`moderation.player.political.${type}`),
      })}
      canContinue={form.formState.isValid}
      pending={create.isPending || update.isPending}
      onContinue={() => setConfirming(true)}
      onBack={() => setConfirming(false)}
      onCancel={onClose}
      onSubmit={(event) => void submit(event)}
      labels={{
        cancel: t('confirm.cancel'),
        back: t('moderation.actions.back'),
        continue: t('moderation.actions.continue'),
        confirm: t('moderation.actions.confirm'),
      }}
    >
      {!editing && (
        <div className="flex flex-col gap-1.5">
          <Label>{t('organisations.columns.level')}</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <OptionSelect<PoliticalEntityType>
                size="default"
                label={t('organisations.columns.level')}
                value={field.value}
                options={levels.map((l) => ({
                  value: l,
                  label: t(`moderation.player.political.${l}`),
                }))}
                onChange={field.onChange}
                className="w-48"
              />
            )}
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="political-name">{t('organisations.columns.name')}</Label>
        <Input id="political-name" maxLength={64} {...form.register('name')} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="political-description">{t('organisations.manage.description')}</Label>
        <Textarea
          id="political-description"
          maxLength={DESCRIPTION_MAX}
          {...form.register('description')}
        />
      </div>
      {!editing && (
        <div className="flex flex-col gap-1.5">
          <Label>{t('organisations.head')}</Label>
          <Controller
            control={form.control}
            name="headId"
            render={({ field }) => (
              <ProfilePicker
                value={field.value || null}
                onChange={field.onChange}
                label={t('organisations.manage.searchProfile')}
              />
            )}
          />
        </div>
      )}
    </TwoStepDialog>
  );
}
