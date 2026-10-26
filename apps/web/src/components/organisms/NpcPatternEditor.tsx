import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { MAX_PATTERN_DAYS, type Pattern } from '@dyingstar-admin/contracts/npc';
import { LabelledField } from '@/components/molecules/LabelledField';
import { ScheduleGrid } from '@/components/molecules/ScheduleGrid';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCan } from '@/hooks/useCan';
import { useDeletePattern, useSavePattern } from '@/hooks/useNpcActions';
import { cn } from '@/lib/cn';
import {
  addDay,
  blankDay,
  letterClass,
  paintCell,
  PatternFormSchema,
  removeDay,
  writeError,
  type NpcFormError,
  type PatternForm,
} from '@/lib/npcs';

interface Letter {
  letter: string;
  activity: string;
  label: string;
}

interface NpcPatternEditorProps {
  /** The pattern edited, or null for a new one. */
  pattern: Pattern | null;
  /** The grid letters (`GET /schedule/legend`). */
  letters: Letter[];
  hours: number;
  onSaved: (name: string) => void;
  onDeleted: () => void;
}

/**
 * Edits a shift pattern (ADR 0031): its name (new ones), description and grid, days ×
 * planetary hours, painted with the letter picked in the legend; days added or removed (1 to
 * 14). Read only without `npc.manage`. Deleting it is confirmed (the service refuses while NPCs
 * follow it). Every write reloads the schedules of the running NPCs.
 */
export function NpcPatternEditor({
  pattern,
  letters,
  hours,
  onSaved,
  onDeleted,
}: NpcPatternEditorProps) {
  const { t } = useTranslation();
  const can = useCan();
  const manage = can('npc.manage');
  const save = useSavePattern();
  const remove = useDeletePattern();
  const [brush, setBrush] = useState('T');
  const [deleting, setDeleting] = useState(false);
  const form = useForm<PatternForm>({
    resolver: zodResolver(PatternFormSchema),
    defaultValues: {
      name: pattern?.name ?? '',
      description: pattern?.description ?? '',
      days: pattern?.days ?? [blankDay(hours)],
    },
    mode: 'onChange',
  });
  const days = useWatch({ control: form.control, name: 'days' });
  const errors = form.formState.errors;
  const message = (code: string | undefined) =>
    code ? t(`npcs.errors.${code as NpcFormError}`) : undefined;
  const meaning = (letter: string) =>
    letters.find((l) => l.letter === letter)?.label ?? t('npcs.patterns.unknownLetter');
  const setDays = (next: string[]) =>
    form.setValue('days', next, { shouldDirty: true, shouldValidate: true });

  const submit = form.handleSubmit(async (valid) => {
    const description = valid.description.trim();
    try {
      await save.mutateAsync(
        pattern
          ? {
              name: pattern.name,
              update: { days: valid.days, ...(description ? { description } : {}) },
            }
          : {
              create: {
                name: valid.name,
                days: valid.days,
                ...(description ? { description } : {}),
              },
            },
      );
      toast.success(t('npcs.patterns.saved', { name: valid.name }));
      form.reset(valid);
      onSaved(valid.name);
    } catch (error) {
      toast.error(writeError(error, t('npcs.unavailable')));
    }
  });

  const confirmDelete = async () => {
    setDeleting(false);
    if (!pattern) return;
    try {
      await remove.mutateAsync(pattern.name);
      toast.success(t('npcs.patterns.deleted', { name: pattern.name }));
      onDeleted();
    } catch (error) {
      toast.error(writeError(error, t('npcs.unavailable')));
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      aria-label={
        pattern ? t('npcs.patterns.editTitle', { name: pattern.name }) : t('npcs.patterns.newTitle')
      }
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      <h3 className="text-sm font-semibold">
        {pattern
          ? t('npcs.patterns.editTitle', { name: pattern.name })
          : t('npcs.patterns.newTitle')}
      </h3>
      <div className="flex flex-wrap gap-3">
        {!pattern && (
          <LabelledField
            id="pattern-name"
            label={t('npcs.patterns.name')}
            hint={t('npcs.patterns.nameHint')}
            error={message(errors.name?.message)}
            className="w-60"
          >
            <Input
              id="pattern-name"
              aria-invalid={!!errors.name}
              aria-describedby="pattern-name-message"
              disabled={!manage}
              {...form.register('name')}
            />
          </LabelledField>
        )}
        <LabelledField
          id="pattern-description"
          label={t('npcs.patterns.description')}
          error={message(errors.description?.message)}
          className="min-w-60 flex-1"
        >
          <Input
            id="pattern-description"
            aria-describedby="pattern-description-message"
            disabled={!manage}
            {...form.register('description')}
          />
        </LabelledField>
      </div>
      {manage && (
        <div role="toolbar" aria-label={t('npcs.patterns.brush')} className="flex flex-wrap gap-2">
          {letters.map((l) => (
            <button
              key={l.letter}
              type="button"
              aria-pressed={brush === l.letter}
              onClick={() => setBrush(l.letter)}
              className={cn(
                'flex items-center gap-2 rounded-md border px-2 py-1 text-xs',
                brush === l.letter ? 'border-link text-link' : 'text-fg-2',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-5 items-center justify-center rounded-xs font-mono text-3xs',
                  letterClass(l.letter),
                )}
              >
                {l.letter}
              </span>
              {l.label}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <Controller
          control={form.control}
          name="days"
          render={() => (
            <ScheduleGrid
              days={days}
              hours={hours}
              label={t('npcs.patterns.grid')}
              dayLabel={(day) => t('npcs.patterns.day', { day: day + 1 })}
              letterLabel={meaning}
              cellLabel={(day, hour, what) =>
                t('npcs.patterns.cell', { day: day + 1, hour, meaning: what })
              }
              onPaint={
                manage ? (day, hour) => setDays(paintCell(days, day, hour, brush)) : undefined
              }
            />
          )}
        />
      </div>
      {errors.days && (
        <p role="alert" className="text-2xs text-destructive">
          {message(errors.days.message ?? 'unevenDays')}
        </p>
      )}
      {manage && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={days.length >= MAX_PATTERN_DAYS}
            onClick={() => setDays(addDay(days, hours))}
          >
            {t('npcs.patterns.addDay')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={days.length <= 1}
            onClick={() => setDays(removeDay(days, days.length - 1))}
          >
            {t('npcs.patterns.removeDay')}
          </Button>
          <span className="flex-1" />
          {pattern && (
            <Button type="button" size="sm" variant="destructive" onClick={() => setDeleting(true)}>
              {t('npcs.patterns.delete')}
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!form.formState.isValid || !form.formState.isDirty || save.isPending}
          >
            {t('npcs.patterns.save')}
          </Button>
        </div>
      )}
      {deleting && pattern && (
        <WriteConfirm
          open
          destructive
          title={t('npcs.patterns.deleteTitle', { name: pattern.name })}
          description={<p>{t('npcs.patterns.deleteText')}</p>}
          confirmLabel={t('npcs.patterns.delete')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(false)}
        />
      )}
    </form>
  );
}
