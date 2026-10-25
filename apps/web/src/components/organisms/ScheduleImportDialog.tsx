import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { ImportReport } from '@dyingstar-admin/contracts/npc';
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
import { Textarea } from '@/components/ui/textarea';
import { useImportSchedules } from '@/hooks/useNpcActions';
import { writeError } from '@/lib/npcs';

const ImportFormSchema = z
  .object({
    mode: z.enum(['missing', 'overwrite']),
    source: z.enum(['shipped', 'pasted']),
    yaml: z.string(),
  })
  .refine((form) => form.source === 'shipped' || form.yaml.trim().length > 0, {
    error: 'required',
    path: ['yaml'],
  });
type ImportForm = z.infer<typeof ImportFormSchema>;

const REPORT_KEYS = ['created', 'updated', 'skipped', 'errors'] as const;

/**
 * Imports shift schedules (ADR 0026): the service's own `config/schedules.yaml`, or YAML pasted
 * in that format; `missing` only adds the patterns and mapping rows that are absent (edits made
 * here are kept), `overwrite` replaces them. Then the service's report: created, updated,
 * skipped, refused (with why).
 */
export function ScheduleImportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const run = useImportSchedules();
  const [report, setReport] = useState<ImportReport | null>(null);
  const form = useForm<ImportForm>({
    resolver: zodResolver(ImportFormSchema),
    defaultValues: { mode: 'missing', source: 'shipped', yaml: '' },
    mode: 'onChange',
  });
  const source = useWatch({ control: form.control, name: 'source' });

  const submit = form.handleSubmit(async (valid) => {
    try {
      const done = await run.mutateAsync({
        mode: valid.mode,
        ...(valid.source === 'pasted' ? { yaml: valid.yaml } : {}),
      });
      setReport(done?.report ?? null);
    } catch (error) {
      toast.error(writeError(error, t('npcs.unavailable')));
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-160">
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('npcs.import.title')}</DialogTitle>
            <DialogDescription>{t('npcs.import.hint')}</DialogDescription>
          </DialogHeader>
          {report ? (
            <dl aria-label={t('npcs.import.report')} className="flex flex-col gap-2 text-sm">
              {REPORT_KEYS.map((key) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-fg-3">
                    {t(`npcs.import.${key}`, { count: report[key].length })}
                  </dt>
                  <dd className={key === 'errors' && report[key].length ? 'text-destructive' : ''}>
                    {report[key].length ? report[key].join(', ') : t('npcs.none')}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <LabelledField id="import-mode" label={t('npcs.import.mode')}>
                  <Controller
                    control={form.control}
                    name="mode"
                    render={({ field }) => (
                      <OptionSelect<ImportForm['mode']>
                        size="default"
                        label={t('npcs.import.mode')}
                        value={field.value}
                        options={[
                          { value: 'missing', label: t('npcs.import.modes.missing') },
                          { value: 'overwrite', label: t('npcs.import.modes.overwrite') },
                        ]}
                        onChange={field.onChange}
                        className="w-64"
                      />
                    )}
                  />
                </LabelledField>
                <LabelledField id="import-source" label={t('npcs.import.source')}>
                  <Controller
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <OptionSelect<ImportForm['source']>
                        size="default"
                        label={t('npcs.import.source')}
                        value={field.value}
                        options={[
                          { value: 'shipped', label: t('npcs.import.sources.shipped') },
                          { value: 'pasted', label: t('npcs.import.sources.pasted') },
                        ]}
                        onChange={(v) => {
                          field.onChange(v);
                          void form.trigger();
                        }}
                        className="w-64"
                      />
                    )}
                  />
                </LabelledField>
              </div>
              {source === 'pasted' && (
                <LabelledField
                  id="import-yaml"
                  label={t('npcs.import.yaml')}
                  hint={t('npcs.import.yamlHint')}
                >
                  <Textarea
                    id="import-yaml"
                    rows={12}
                    spellCheck={false}
                    className="font-mono text-xs"
                    aria-describedby="import-yaml-message"
                    {...form.register('yaml')}
                  />
                </LabelledField>
              )}
            </>
          )}
          <DialogFooter>
            {report ? (
              <Button type="button" onClick={onClose}>
                {t('npcs.import.close')}
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={onClose}>
                  {t('confirm.cancel')}
                </Button>
                <Button type="submit" disabled={!form.formState.isValid || run.isPending}>
                  {t('npcs.import.submit')}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
