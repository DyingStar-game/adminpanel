import { useMemo, useState } from 'react';
import { TextSearchIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ImportRow } from '@dyingstar-admin/schemas';
import { CopyButton } from '@/components/atoms/CopyButton';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import { FindingView } from '@/components/molecules/FindingView';
import { Pagination } from '@/components/molecules/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ImportOutcome } from '@/hooks/useImport';
import { cn } from '@/lib/cn';
import { isProbableDuplicate } from '@/lib/importInput';

export type ImportFilter = 'all' | 'invalid' | 'warnings' | 'new' | 'conflict' | 'failed';

interface ImportResultsProps {
  rows: ImportRow[];
  /** Normalized items, by row index (names shown next to the UUID). */
  items: unknown[];
  generated: Set<number>;
  overwrite: Set<number>;
  onOverwrite: (index: number, overwrite: boolean) => void;
  outcomes: Map<number, ImportOutcome>;
  /** Puts the cursor on the row's item in the JSON field (when its place is known). */
  onShowInJson?: ((index: number) => void) | undefined;
}

const PAGE_SIZE = 50;

const nameOf = (item: unknown): string | null => {
  const data = (item as { object_data?: { name?: unknown } } | null)?.object_data;
  return typeof data?.name === 'string' && data.name ? data.name : null;
};

/** Checked rows of a bulk import (ADR 0019): status, findings with their path, overwrite choice. */
export function ImportResults({
  rows,
  items,
  generated,
  overwrite,
  onOverwrite,
  outcomes,
  onShowInJson,
}: ImportResultsProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<ImportFilter>('all');
  const [page, setPage] = useState(1);

  const matches = useMemo(() => {
    const tests: Record<ImportFilter, (row: ImportRow) => boolean> = {
      all: () => true,
      invalid: (row) => row.status === 'invalid',
      warnings: (row) => row.findings.some((f) => f.severity === 'warning'),
      new: (row) => row.status === 'new',
      conflict: (row) => row.status === 'conflict',
      failed: (row) => outcomes.get(row.index)?.state === 'failed',
    };
    return tests;
  }, [outcomes]);
  const filters: ImportFilter[] = ['all', 'invalid', 'warnings', 'new', 'conflict', 'failed'];
  const shown = rows.filter(matches[filter]);
  const pageRows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section aria-label={t('import.results')} className="flex flex-col gap-3">
      <div role="tablist" aria-label={t('import.filter')} className="flex flex-wrap gap-1.5">
        {filters.map((key) => {
          const count = rows.filter(matches[key]).length;
          if (key === 'failed' && count === 0) return null;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => {
                setFilter(key);
                setPage(1);
              }}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs',
                filter === key ? 'border-link bg-link-bg text-link' : 'text-fg-2 hover:bg-white/5',
              )}
            >
              {t(`import.filters.${key}`)} · {count}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-col divide-y rounded-lg border">
        {pageRows.map((row) => (
          <ImportRowView
            key={row.index}
            row={row}
            name={nameOf(items[row.index])}
            generated={generated.has(row.index)}
            overwrite={overwrite.has(row.index)}
            onOverwrite={(value) => onOverwrite(row.index, value)}
            outcome={outcomes.get(row.index)}
            onShowInJson={onShowInJson && (() => onShowInJson(row.index))}
          />
        ))}
        {pageRows.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-fg-3">{t('import.noRow')}</li>
        )}
      </ul>
      <Pagination page={page} pageSize={PAGE_SIZE} total={shown.length} onPageChange={setPage} />
    </section>
  );
}

const STATUS_STYLE: Record<ImportRow['status'], string> = {
  invalid: 'border-destructive/40 bg-destructive/10 text-destructive',
  new: 'border-success/40 bg-success/10 text-success',
  conflict: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
};

function ImportRowView({
  row,
  name,
  generated,
  overwrite,
  onOverwrite,
  outcome,
  onShowInJson,
}: {
  onShowInJson?: (() => void) | undefined;
  row: ImportRow;
  name: string | null;
  generated: boolean;
  overwrite: boolean;
  onOverwrite: (overwrite: boolean) => void;
  outcome: ImportOutcome | undefined;
}) {
  const { t } = useTranslation();
  const switchId = `import-overwrite-${row.index}`;
  return (
    <li
      aria-label={t('import.row', { index: row.index + 1 })}
      data-duplicate={isProbableDuplicate(row) || undefined}
      className={cn(
        'flex flex-col gap-1.5 px-3 py-2',
        isProbableDuplicate(row) && 'border-l-4 border-l-amber-500 bg-amber-500/10',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <MonoText tone="subtle" className="w-10 shrink-0 text-2xs">
          #{row.index + 1}
        </MonoText>
        <Badge variant="outline" className={cn('text-2xs', STATUS_STYLE[row.status])}>
          {t(`import.status.${row.status}`)}
        </Badge>
        {row.object_type && (
          <span className="flex items-center gap-1.5">
            <TypeDot objectType={row.object_type} />
            <MonoText className="text-xs">{row.object_type}</MonoText>
          </span>
        )}
        {name && <span className="font-medium">{name}</span>}
        {row.object_uuid && (
          <span className="flex items-center gap-1">
            <MonoText tone="muted" className="text-2xs">
              {row.object_uuid}
            </MonoText>
            <CopyButton value={row.object_uuid} />
            {generated && (
              <MonoText tone="subtle" className="text-2xs">
                {t('import.generated')}
              </MonoText>
            )}
          </span>
        )}
        <span className="flex-1" />
        {onShowInJson && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t('import.showInJson')}
            title={t('import.showInJson')}
            onClick={onShowInJson}
          >
            <TextSearchIcon />
          </Button>
        )}
        {row.status === 'conflict' && !outcome && (
          <span className="flex items-center gap-1.5">
            <Switch id={switchId} size="sm" checked={overwrite} onCheckedChange={onOverwrite} />
            <Label htmlFor={switchId} className="text-xs font-normal">
              {t('import.overwrite')}
            </Label>
          </span>
        )}
        {outcome && (
          <Badge
            variant={outcome.state === 'failed' ? 'destructive' : 'outline'}
            className="text-2xs"
            title={outcome.state === 'failed' ? outcome.message : undefined}
          >
            {t(`import.outcome.${outcome.state}`)}
          </Badge>
        )}
      </div>
      {row.findings.length > 0 && (
        <ul className="ml-12 flex flex-col gap-0.5">
          {row.findings.map((finding, i) => (
            <FindingView key={i} finding={finding} />
          ))}
        </ul>
      )}
      {outcome?.state === 'failed' && (
        <p className="ml-12 text-xs text-destructive">{outcome.message}</p>
      )}
    </li>
  );
}
