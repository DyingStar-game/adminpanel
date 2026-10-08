import { useEffect, useMemo, useState } from 'react';
import { DownloadIcon, EraserIcon, RotateCcwIcon, SearchCheckIcon, UploadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  checkImportFormat,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ITEMS,
  UuidSchema,
} from '@dyingstar-admin/schemas';
import { JsonDropField } from '@/components/molecules/JsonDropField';
import { PageHeading } from '@/components/molecules/PageHeading';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { ImportResults } from '@/components/organisms/ImportResults';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useDefinitions } from '@/hooks/queries';
import { useImportCheck, useImportRun, type ImportOutcome } from '@/hooks/useImport';
import { useImportDraft } from '@/stores/importDraft';
import { useWriteTarget } from '@/hooks/useWriteTarget';
import { cn } from '@/lib/cn';
import {
  importSummary,
  isProbableDuplicate,
  itemRanges,
  normalizeImport,
  parseImportText,
} from '@/lib/importInput';
import type { ImportSearch } from '@/lib/importSearch';

interface ImportPageProps {
  search: ImportSearch;
}

const megabytes = (bytes: number) => Math.round(bytes / 1024 / 1024);

/**
 * Bulk import (ADR 0004, 0019): paste or drop JSON, check every item, then send. The draft
 * lives in a store: it survives moving to other pages, only Clear empties it.
 */
export function ImportPage({ search }: ImportPageProps) {
  const { t } = useTranslation();
  const definitions = useDefinitions();
  const check = useImportCheck();
  const { run: start, cancel } = useImportRun();
  const { isProduction, serverName } = useWriteTarget();
  const {
    text,
    fileName,
    defaultParent,
    useDefaultParent,
    inputError,
    checked,
    checking,
    overwrite,
    run,
    edit,
    setDefaultParent,
    setUseDefaultParent,
    setInputError,
    setChecked,
    setOverwrite,
    clear,
  } = useImportDraft();
  const [confirming, setConfirming] = useState(false);
  const [focusAt, setFocusAt] = useState<{ offset: number; nonce: number } | null>(null);

  // Opened from a level: it becomes the default parent of a new draft (never of a kept one).
  useEffect(() => {
    const draft = useImportDraft.getState();
    if (search.parent !== undefined && !draft.text && !draft.checked) {
      draft.setDefaultParent(search.parent);
      draft.setUseDefaultParent(true);
    }
  }, [search.parent]);

  const parentOk =
    !useDefaultParent || defaultParent === '' || UuidSchema.safeParse(defaultParent).success;

  const runCheck = async () => {
    const parsed = parseImportText(text);
    if (!parsed.ok) return setInputError(parsed);
    setInputError(null);
    const normalized = normalizeImport(parsed.items, {
      defaultParentId: useDefaultParent ? defaultParent : null,
      newUuid: () => crypto.randomUUID(),
    });
    const types = (definitions.data?.definitions ?? []).map((d) => d.type);
    // Format findings at once, then the server's statuses and coherence warnings.
    setChecked({
      ...normalized,
      rows: checkImportFormat(normalized.items, types),
      fromServer: false,
    });
    setOverwrite(() => new Set());
    try {
      await check(normalized);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('import.checkFailed'));
    }
  };

  const summary = checked ? importSummary(checked.rows) : null;
  // Where each item sits in the text (unchanged since the check: an edit drops the check).
  const ranges = useMemo(() => (checked ? itemRanges(text) : []), [checked, text]);
  const duplicateLines = useMemo(
    () =>
      (checked?.rows ?? []).flatMap((row) => {
        const range = ranges[row.index];
        return range && isProbableDuplicate(row) ? [range] : [];
      }),
    [checked, ranges],
  );
  const plan = useMemo(
    () =>
      (checked?.rows ?? []).flatMap((row) =>
        row.status === 'new'
          ? [{ index: row.index, overwrite: false }]
          : row.status === 'conflict' && overwrite.has(row.index)
            ? [{ index: row.index, overwrite: true }]
            : [],
      ),
    [checked, overwrite],
  );
  const serverChecked = !!checked?.fromServer && !checking;
  const finished = !run.running && run.outcomes.size > 0;
  const failed = [...run.outcomes].filter(([, o]) => o.state === 'failed').map(([index]) => index);

  const send = (indices = plan, previous = new Map<number, ImportOutcome>()) => {
    if (!checked) return;
    void start(checked.items, indices, previous);
  };
  const askSend = () => setConfirming(true);
  const retry = () =>
    send(
      plan.filter((p) => failed.includes(p.index)),
      run.outcomes,
    );

  const downloadReport = () => {
    if (!checked) return;
    const report = {
      server: serverName,
      at: new Date().toISOString(),
      rows: checked.rows.map((row) => ({
        index: row.index,
        object_uuid: row.object_uuid,
        object_type: row.object_type,
        status: row.status,
        outcome: run.outcomes.get(row.index) ?? { state: 'skipped' },
        findings: row.findings,
      })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `import-report-${report.at.replace(/[:.]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const conflicts = checked?.rows.filter((r) => r.status === 'conflict').map((r) => r.index) ?? [];
  const toOverwrite = plan.filter((p) => p.overwrite).length;
  const planned = new Set(plan.map((p) => p.index));
  const withWarnings = (checked?.rows ?? []).filter(
    (r) => planned.has(r.index) && r.findings.some((f) => f.severity === 'warning'),
  ).length;
  /** Rows not sent: invalid, or existing and not overwritten. */
  const skipped = (checked?.rows.length ?? 0) - plan.length;
  const allOverwritten = conflicts.length > 0 && conflicts.every((i) => overwrite.has(i));

  return (
    <ScrollArea className="min-h-0 flex-1">
      {/* Same layout as Persistence — Items: title, then the content in a card. */}
      <div className="flex flex-col gap-5 p-6">
        <PageHeading title={t('import.title')}>
          <p className="text-sm text-fg-2">
            {t('import.intro', { max: IMPORT_MAX_ITEMS, size: megabytes(IMPORT_MAX_BYTES) })}
          </p>
          <p className="text-xs text-fg-3">{t('editor.liveWarning', { server: serverName })}</p>
        </PageHeading>
        <div className="flex flex-col gap-5 rounded-xl border bg-surface-2 p-5">
          <section aria-label={t('import.input')} className="flex flex-col gap-3">
            <JsonDropField
              id="import-json"
              value={text}
              onChange={(value) => edit(value)}
              onFile={(content, name) => edit(content, name)}
              onTooLarge={(name) =>
                toast.error(t('import.fileTooLarge', { name, size: megabytes(IMPORT_MAX_BYTES) }))
              }
              maxBytes={IMPORT_MAX_BYTES}
              invalid={!!inputError}
              errorLine={inputError?.reason === 'syntax' ? inputError.line : undefined}
              highlights={duplicateLines}
              focusAt={focusAt}
              labels={{
                field: t('import.field'),
                drop: t('import.drop'),
                pick: t('import.pick'),
                placeholder: t('import.placeholder'),
              }}
            />
            {fileName && (
              <p className="text-xs text-fg-2">{t('import.loaded', { name: fileName })}</p>
            )}
            {inputError && (
              <p
                role="alert"
                className="flex flex-wrap items-center gap-2 text-sm text-destructive"
              >
                {inputError.reason === 'syntax'
                  ? t('import.errors.syntax', {
                      line: inputError.line,
                      column: inputError.column,
                      message: t(
                        `import.syntax.${inputError.message}` as 'import.syntax.ValueExpected',
                        {
                          defaultValue: inputError.message,
                        },
                      ),
                    })
                  : t(`import.errors.${inputError.reason}`, {
                      max: IMPORT_MAX_ITEMS,
                      size: megabytes(IMPORT_MAX_BYTES),
                    })}
                {inputError.reason === 'syntax' && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setFocusAt({ offset: inputError.offset, nonce: Date.now() })}
                  >
                    {t('import.goToError')}
                  </Button>
                )}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2">
                <Switch
                  id="import-default-parent"
                  checked={useDefaultParent}
                  onCheckedChange={setUseDefaultParent}
                />
                <Label htmlFor="import-default-parent" className="font-normal">
                  {t('import.defaultParent')}
                </Label>
              </span>
              {useDefaultParent && (
                <Input
                  aria-label="parent_id"
                  value={defaultParent}
                  onChange={(event) => setDefaultParent(event.target.value.trim())}
                  placeholder={t('import.rootHint')}
                  aria-invalid={!parentOk}
                  className={cn('h-8 w-85 font-mono text-xs', !parentOk && 'border-destructive')}
                />
              )}
              <span className="flex-1" />
              <Button
                variant="outline"
                onClick={clear}
                disabled={(!text && !checked) || run.running}
              >
                <EraserIcon />
                {t('import.clear')}
              </Button>
              <Button
                onClick={() => void runCheck()}
                disabled={!text.trim() || !parentOk || checking || run.running}
              >
                <SearchCheckIcon />
                {checking ? t('import.checking') : t('import.check')}
              </Button>
            </div>
          </section>

          {checked && summary && (
            <>
              <section
                aria-label={t('import.summaryTitle')}
                className="flex flex-wrap items-center gap-3 rounded-lg border bg-background px-4 py-3 text-sm"
              >
                <span>{t('import.summary', summary)}</span>
                {!serverChecked && (
                  <span className="text-xs text-fg-3">{t('import.formatOnly')}</span>
                )}
                <span className="flex-1" />
                {conflicts.length > 0 && !run.running && !finished && (
                  <span className="flex items-center gap-2">
                    <Switch
                      id="import-overwrite-all"
                      checked={allOverwritten}
                      onCheckedChange={(value) =>
                        setOverwrite(() => (value ? new Set(conflicts) : new Set()))
                      }
                    />
                    <Label htmlFor="import-overwrite-all" className="font-normal">
                      {t('import.overwriteAll', { count: conflicts.length })}
                    </Label>
                  </span>
                )}
                {!finished && (
                  <Button
                    onClick={askSend}
                    disabled={!serverChecked || plan.length === 0 || run.running}
                    className={cn(
                      isProduction &&
                        'border-destructive/40 bg-destructive/15 text-destructive shadow-none hover:bg-destructive/25',
                    )}
                  >
                    <UploadIcon />
                    {t('import.send', { count: plan.length })}
                  </Button>
                )}
              </section>

              {(run.running || finished) && (
                <section aria-label={t('import.progressTitle')} className="flex flex-col gap-2">
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={run.total}
                    aria-valuenow={run.done}
                    className="h-2 overflow-hidden rounded-full bg-surface-3"
                  >
                    <div
                      className="h-full rounded-full bg-link transition-[width]"
                      style={{ width: `${run.total ? (run.done / run.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>
                      {t('import.progress', { done: run.done, total: run.total })}
                      {finished &&
                        ` · ${t('import.result', {
                          created: [...run.outcomes.values()].filter((o) => o.state === 'created')
                            .length,
                          overwritten: [...run.outcomes.values()].filter(
                            (o) => o.state === 'overwritten',
                          ).length,
                          failed: failed.length,
                        })}`}
                      {run.cancelled && ` · ${t('import.cancelled')}`}
                    </span>
                    <span className="flex-1" />
                    {run.running && (
                      <Button variant="outline" size="sm" onClick={cancel}>
                        {t('confirm.cancel')}
                      </Button>
                    )}
                    {finished && failed.length > 0 && (
                      <Button variant="outline" size="sm" onClick={retry}>
                        <RotateCcwIcon />
                        {t('import.retry', { count: failed.length })}
                      </Button>
                    )}
                    {finished && (
                      <Button variant="outline" size="sm" onClick={downloadReport}>
                        <DownloadIcon />
                        {t('import.report')}
                      </Button>
                    )}
                  </div>
                </section>
              )}

              <ImportResults
                rows={checked.rows}
                items={checked.items}
                generated={checked.generated}
                overwrite={overwrite}
                onOverwrite={(index, value) =>
                  setOverwrite((current) => {
                    const next = new Set(current);
                    if (value) next.add(index);
                    else next.delete(index);
                    return next;
                  })
                }
                outcomes={run.outcomes}
                onShowInJson={(index) => {
                  const range = ranges[index];
                  if (range) setFocusAt({ offset: range.offset, nonce: Date.now() });
                }}
              />
            </>
          )}
        </div>
      </div>
      {/* Always confirmed: an import can create or overwrite thousands of items live. */}
      <WriteConfirm
        open={confirming}
        title={t('import.confirmTitle', { count: plan.length })}
        destructive={isProduction || toOverwrite > 0}
        description={
          <>
            <ul className="list-disc pl-5">
              <li>{t('import.confirmCreate', { count: plan.length - toOverwrite })}</li>
              {toOverwrite > 0 && (
                <li className="font-medium text-destructive">
                  {t('import.confirmOverwrite', { count: toOverwrite })}
                </li>
              )}
              {withWarnings > 0 && <li>{t('import.confirmWarnings', { count: withWarnings })}</li>}
              {skipped > 0 && <li>{t('import.confirmSkipped', { count: skipped })}</li>}
            </ul>
            <p>{t('import.confirmLive', { server: serverName })}</p>
            {isProduction && (
              <p className="font-medium">{t('editor.productionBody', { server: serverName })}</p>
            )}
          </>
        }
        confirmLabel={t('import.send', { count: plan.length })}
        cancelLabel={t('confirm.cancel')}
        onConfirm={() => {
          setConfirming(false);
          send();
        }}
        onCancel={() => setConfirming(false)}
      />
    </ScrollArea>
  );
}
