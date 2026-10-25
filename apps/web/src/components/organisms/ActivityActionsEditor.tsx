import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_KEYS, type ActivityKey } from '@dyingstar-admin/contracts/npc';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { useSaveActivityActions } from '@/hooks/useNpcActions';
import { cn } from '@/lib/cn';
import { writeError } from '@/lib/npcs';

type Mapping = Record<ActivityKey, string[]>;

/** Every activity and its actions (names from the catalogue, never empty). */
const MappingFormSchema = z.object(
  Object.fromEntries(ACTIVITY_KEYS.map((k) => [k, z.array(z.string().min(1))])) as Record<
    ActivityKey,
    z.ZodArray<z.ZodString>
  >,
);

interface ActivityActionsEditorProps {
  /** The mapping in force (`GET /schedule/activity-actions`). */
  mapping: Record<string, string[]>;
  /** The actions offered: those run by hand (`task-kinds` › `actions`). */
  actions: string[];
}

const toMapping = (items: Record<string, string[]>): Mapping =>
  Object.fromEntries(ACTIVITY_KEYS.map((k) => [k, [...(items[k] ?? [])]])) as Mapping;

/**
 * The activity → actions mapping of the shift schedules (ADR 0026): for each activity (work,
 * handoff, meal, mandatory activities, off; `always` = in every activity), the actions an NPC
 * may run during it, toggled among the actions the service runs by hand and those already
 * mapped. Only the activities changed are sent. Read only without `npc.manage`.
 */
export function ActivityActionsEditor({ mapping, actions }: ActivityActionsEditorProps) {
  const { t } = useTranslation();
  const can = useCan();
  const manage = can('npc.manage');
  const save = useSaveActivityActions();
  const form = useForm<Mapping>({
    resolver: zodResolver(MappingFormSchema),
    defaultValues: toMapping(mapping),
  });
  const options = [...new Set([...actions, ...Object.values(mapping).flat()])].sort();

  const submit = form.handleSubmit(async (values) => {
    const initial = toMapping(mapping);
    const changed = Object.fromEntries(
      ACTIVITY_KEYS.filter(
        (k) => JSON.stringify([...values[k]].sort()) !== JSON.stringify([...initial[k]].sort()),
      ).map((k) => [k, values[k]]),
    );
    try {
      const saved = await save.mutateAsync(changed);
      toast.success(t('npcs.mapping.saved'));
      form.reset(toMapping(saved?.items ?? { ...mapping, ...changed }));
    } catch (error) {
      toast.error(writeError(error, t('npcs.unavailable')));
    }
  });

  return (
    <form
      onSubmit={(event) => void submit(event)}
      aria-label={t('npcs.mapping.title')}
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <div>
        <h3 className="text-sm font-semibold">{t('npcs.mapping.title')}</h3>
        <p className="text-xs text-fg-3">{t('npcs.mapping.hint')}</p>
      </div>
      {ACTIVITY_KEYS.map((activity) => (
        <Controller
          key={activity}
          control={form.control}
          name={activity}
          render={({ field }) => (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-xs font-semibold">
                {t(`npcs.activities.${activity}`)}
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {options.map((action) => {
                  const on = field.value.includes(action);
                  return (
                    <button
                      key={action}
                      type="button"
                      aria-pressed={on}
                      aria-label={t('npcs.mapping.toggle', {
                        action,
                        activity: t(`npcs.activities.${activity}`),
                      })}
                      disabled={!manage}
                      onClick={() =>
                        field.onChange(
                          on ? field.value.filter((a) => a !== action) : [...field.value, action],
                        )
                      }
                      className={cn(
                        'rounded-md border px-2 py-0.5 font-mono text-2xs',
                        on ? 'border-link bg-link-bg text-link' : 'text-fg-3',
                        !manage && 'cursor-default',
                      )}
                    >
                      {action}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        />
      ))}
      {manage && (
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!form.formState.isDirty || save.isPending}>
            {t('npcs.mapping.save')}
          </Button>
        </div>
      )}
    </form>
  );
}
