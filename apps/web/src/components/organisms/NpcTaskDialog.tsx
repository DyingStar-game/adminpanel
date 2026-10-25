import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { MAX_TASK_SECONDS, type TaskKind } from '@dyingstar-admin/contracts/npc';
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
import { Textarea } from '@/components/ui/textarea';
import { useCreateNpcTask } from '@/hooks/useNpcActions';
import { useTaskKinds } from '@/hooks/useNpcs';
import {
  configTemplate,
  TASK_FORM_DEFAULTS,
  TaskFormSchema,
  taskToCreate,
  writeError,
  type NpcFormError,
  type TaskForm,
} from '@/lib/npcs';

interface NpcTaskDialogProps {
  npc: { id: string; displayName: string };
  onClose: () => void;
}

/**
 * Gives an NPC a task by hand (ADR 0026), which pre-empts its schedule: walk to a position
 * (local to an object, or its own frame) and stay there, focus on one action (with overrides of
 * its config, offered from the fields the service lists), or wait. Empty optional fields keep
 * the service's defaults; `forceOnline` connects it even off shift.
 */
export function NpcTaskDialog({ npc, onClose }: NpcTaskDialogProps) {
  const { t } = useTranslation();
  const kinds = useTaskKinds();
  const create = useCreateNpcTask();
  const form = useForm<TaskForm>({
    resolver: zodResolver(TaskFormSchema),
    defaultValues: TASK_FORM_DEFAULTS,
    mode: 'onChange',
  });
  const kind = useWatch({ control: form.control, name: 'kind' });
  const action = useWatch({ control: form.control, name: 'action' });
  const errors = form.formState.errors;
  const message = (field: keyof TaskForm) => {
    const code = errors[field]?.message as NpcFormError | undefined;
    return code ? t(`npcs.errors.${code}`, { max: MAX_TASK_SECONDS }) : undefined;
  };
  const params = kinds.data?.kinds.find((k) => k.kind === kind)?.params ?? {};
  const hint = (name: string) => params[name];
  const actionFields = kinds.data?.actionConfigs[action];

  const number = (field: keyof TaskForm, label: string, help?: string) => (
    <LabelledField
      id={`task-${field}`}
      label={label}
      hint={help}
      error={message(field)}
      className="w-36"
    >
      <Input
        id={`task-${field}`}
        type="number"
        step="any"
        aria-invalid={!!errors[field]}
        aria-describedby={`task-${field}-message`}
        {...form.register(field, { valueAsNumber: true })}
      />
    </LabelledField>
  );

  const submit = form.handleSubmit(async (valid) => {
    try {
      await create.mutateAsync({ id: npc.id, task: taskToCreate(valid) });
      toast.success(t('npcs.tasks.queued', { name: npc.displayName }));
      onClose();
    } catch (error) {
      toast.error(writeError(error, t('npcs.unavailable')));
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-140">
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('npcs.tasks.newTitle', { name: npc.displayName })}</DialogTitle>
            <DialogDescription>{t('npcs.tasks.newHint')}</DialogDescription>
          </DialogHeader>
          <LabelledField id="task-kind" label={t('npcs.tasks.kind')}>
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <OptionSelect<TaskKind>
                  size="default"
                  label={t('npcs.tasks.kind')}
                  value={field.value}
                  options={(['go_to_position', 'run_action', 'wait'] as const).map((k) => ({
                    value: k,
                    label: t(`npcs.tasks.kinds.${k}`),
                  }))}
                  onChange={(v) => {
                    field.onChange(v);
                    void form.trigger();
                  }}
                  className="w-60"
                />
              )}
            />
          </LabelledField>
          {kind === 'go_to_position' && (
            <>
              <div className="flex flex-wrap gap-3">
                {number('x', 'x')}
                {number('y', 'y')}
                {number('z', 'z')}
              </div>
              <LabelledField id="task-uuid" label={t('npcs.tasks.uuid')} hint={hint('uuid')}>
                <Input
                  id="task-uuid"
                  className="font-mono text-xs"
                  aria-describedby="task-uuid-message"
                  {...form.register('uuid')}
                />
              </LabelledField>
              <div className="flex flex-wrap gap-3">
                {number('holdS', t('npcs.tasks.holdS'), hint('hold_s'))}
                {number('timeoutS', t('npcs.tasks.timeoutS'), hint('timeout_s'))}
              </div>
            </>
          )}
          {kind === 'run_action' && (
            <>
              <LabelledField
                id="task-action"
                label={t('npcs.tasks.action')}
                error={message('action')}
              >
                <Controller
                  control={form.control}
                  name="action"
                  render={({ field }) => (
                    <OptionSelect<string>
                      size="default"
                      label={t('npcs.tasks.action')}
                      value={field.value || undefined}
                      placeholder={t('npcs.tasks.pickAction')}
                      options={(kinds.data?.actions ?? []).map((a) => ({ value: a, label: a }))}
                      onChange={(v) => {
                        field.onChange(v);
                        void form.trigger();
                      }}
                      className="w-72"
                    />
                  )}
                />
              </LabelledField>
              <LabelledField
                id="task-config"
                label={t('npcs.tasks.config')}
                hint={
                  actionFields
                    ? t('npcs.tasks.configFields', {
                        fields: Object.entries(actionFields)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · '),
                      })
                    : t('npcs.tasks.configHint')
                }
                error={message('config')}
              >
                <Textarea
                  id="task-config"
                  rows={4}
                  spellCheck={false}
                  className="font-mono text-xs"
                  aria-invalid={!!errors.config}
                  aria-describedby="task-config-message"
                  {...form.register('config')}
                />
              </LabelledField>
              {actionFields && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="self-start"
                  onClick={() =>
                    form.setValue('config', configTemplate(actionFields), { shouldValidate: true })
                  }
                >
                  {t('npcs.tasks.fillConfig')}
                </Button>
              )}
              {number('durationS', t('npcs.tasks.durationS'), hint('duration_s'))}
            </>
          )}
          {kind === 'wait' && number('seconds', t('npcs.tasks.seconds'), hint('seconds'))}
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="forceOnline"
              render={({ field }) => (
                <Switch id="task-online" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="task-online">{t('npcs.tasks.forceOnline')}</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('confirm.cancel')}
            </Button>
            <Button type="submit" disabled={!form.formState.isValid || create.isPending}>
              {t('npcs.tasks.queue')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
