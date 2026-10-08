import { useTranslation } from 'react-i18next';
import type { ModerationLogEntry } from '@dyingstar-admin/contracts/social';
import { Chip } from '@/components/atoms/Chip';
import { MonoText } from '@/components/atoms/MonoText';
import { DataTable } from '@/components/molecules/DataTable';
import { Badge } from '@/components/ui/badge';
import { usePlayerNames } from '@/hooks/useModeration';
import { formatDateTime, shortId } from '@/lib/format';

interface ModerationLogTableProps {
  entries: ModerationLogEntry[];
  onOpenPlayer: (id: string) => void;
  onOpenReport: (id: number) => void;
}

/** Actions `social` logs (its services' `logModeration` calls); others are shown as is. */
const KNOWN = [
  'sanction_issued',
  'sanction_revoked',
  'report_reviewing',
  'report_resolved',
  'report_dismissed',
  'report_escalated',
  'auto_escalated',
] as const;
type KnownAction = (typeof KNOWN)[number];
const isKnown = (action: string): action is KnownAction => KNOWN.includes(action as KnownAction);

/** Colour of an action's badge, by family: sanction given, lifted, report handled, escalation. */
const ACTION_TONE: Record<KnownAction, string> = {
  sanction_issued: 'border-amber-500/50 bg-amber-500/10 text-amber-500',
  sanction_revoked: 'border-success/40 bg-success/10 text-success',
  report_reviewing: 'border-link/40 bg-link-bg text-link',
  report_resolved: 'border-success/40 bg-success/10 text-success',
  report_dismissed: 'border-border text-fg-2',
  report_escalated: 'border-destructive/40 bg-destructive/10 text-destructive',
  auto_escalated: 'border-destructive/40 bg-destructive/10 text-destructive',
};

const text = (details: Record<string, unknown> | null, key: string) =>
  typeof details?.[key] === 'string' && details[key] ? (details[key] as string) : null;
const number = (details: Record<string, unknown> | null, key: string) =>
  typeof details?.[key] === 'number' ? (details[key] as number) : null;

/**
 * The moderation log, readable: who (by name), what (in words, with the sanction type), on whom,
 * and the details that matter (reason, note, the report concerned).
 */
export function ModerationLogTable({
  entries,
  onOpenPlayer,
  onOpenReport,
}: ModerationLogTableProps) {
  const { t, i18n } = useTranslation();
  const names = usePlayerNames(entries.flatMap((e) => [e.actorId, e.targetPlayerId]));

  const player = (id: string | null) =>
    id ? (
      <Chip variant="link" title={id} onClick={() => onOpenPlayer(id)}>
        {names.get(id) ?? <MonoText>{shortId(id)}</MonoText>}
      </Chip>
    ) : (
      <span className="text-fg-3">{t('moderation.system')}</span>
    );

  const action = (entry: ModerationLogEntry) => {
    const type = text(entry.details, 'type');
    const to = text(entry.details, 'to');
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        {isKnown(entry.action) ? (
          <Badge variant="outline" className={ACTION_TONE[entry.action]}>
            {t(`moderation.log.actions.${entry.action}`)}
          </Badge>
        ) : (
          <Badge variant="outline">
            <MonoText>{entry.action}</MonoText>
          </Badge>
        )}
        {type && (
          <Badge variant={type === 'ban' || type === 'suspension' ? 'destructive' : 'outline'}>
            {t(`moderation.sanctionType.${type}` as never, { defaultValue: type })}
          </Badge>
        )}
        {to && (
          <span className="text-fg-3">
            → {t(`moderation.escalation.${to}` as never, { defaultValue: to })}
          </span>
        )}
      </span>
    );
  };

  const details = (entry: ModerationLogEntry) => {
    const reason = text(entry.details, 'reason');
    const note = text(entry.details, 'note');
    const reportId = number(entry.details, 'reportId');
    const balance = number(entry.details, 'balance');
    return (
      <span className="flex flex-wrap items-center gap-2">
        {reason && <span>« {reason} »</span>}
        {note && <span className="text-fg-2">{note}</span>}
        {balance !== null && (
          <span className="text-fg-2">{t('moderation.log.balance', { balance })}</span>
        )}
        {reportId !== null && (
          <Chip variant="link" onClick={() => onOpenReport(reportId)}>
            {t('moderation.report.title', { id: reportId })}
          </Chip>
        )}
        {!reason && !note && reportId === null && balance === null && (
          <span className="text-fg-3">—</span>
        )}
      </span>
    );
  };

  return (
    <DataTable<ModerationLogEntry>
      label={t('moderation.log.title')}
      rows={entries}
      rowKey={(entry) => entry.id}
      empty={t('moderation.none')}
      columns={[
        {
          key: 'date',
          header: t('moderation.columns.date'),
          cell: (entry) => formatDateTime(entry.createdAt, i18n.language),
          className: 'whitespace-nowrap',
        },
        { key: 'actor', header: t('moderation.columns.actor'), cell: (e) => player(e.actorId) },
        { key: 'action', header: t('moderation.columns.action'), cell: action },
        {
          key: 'target',
          header: t('moderation.columns.target'),
          cell: (e) => player(e.targetPlayerId),
        },
        { key: 'details', header: t('moderation.columns.details'), cell: details },
      ]}
    />
  );
}
