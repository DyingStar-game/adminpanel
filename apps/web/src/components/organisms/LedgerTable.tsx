import { useTranslation } from 'react-i18next';
import { MonoText } from '@/components/atoms/MonoText';
import { DataTable } from '@/components/molecules/DataTable';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { formatAmount, ledgerNote, signedAmount, type Transaction } from '@/lib/economy';
import { formatDateTime } from '@/lib/format';

interface LedgerTableProps {
  transactions: Transaction[];
  /** The holder's own accounts: a movement is signed from their side. */
  own: Set<string>;
}

/** A holder's movements in `economie`, newest first, signed from their side (step O). */
export function LedgerTable({ transactions, own }: LedgerTableProps) {
  const { t, i18n } = useTranslation();
  return (
    <DataTable<Transaction>
      label={t('economy.ledger')}
      rows={transactions}
      rowKey={(tx) => String(tx.id)}
      empty={t('moderation.none')}
      columns={[
        {
          key: 'date',
          header: t('moderation.columns.date'),
          cell: (tx) => formatDateTime(tx.createdAt, i18n.language),
          className: 'whitespace-nowrap',
        },
        {
          key: 'type',
          header: t('moderation.columns.type'),
          cell: (tx) => (
            <Badge variant="outline">
              {t(`economy.types.${tx.type}` as never, { defaultValue: tx.type })}
            </Badge>
          ),
        },
        {
          key: 'amount',
          header: t('economy.amount'),
          cell: (tx) => {
            const amount = signedAmount(tx, own);
            return (
              <span
                className={cn('tabular-nums', amount < 0 ? 'text-destructive' : 'text-success')}
              >
                {amount > 0 ? '+' : ''}
                {formatAmount(amount, tx.currency, i18n.language)}
              </span>
            );
          },
          className: 'text-right',
        },
        {
          key: 'tax',
          header: t('economy.tax'),
          cell: (tx) =>
            tx.taxAmount ? (
              <span className="tabular-nums text-fg-2">
                {formatAmount(tx.taxAmount, tx.currency, i18n.language)}
              </span>
            ) : (
              <span className="text-fg-3">—</span>
            ),
          className: 'text-right',
        },
        {
          key: 'reference',
          header: t('economy.reference'),
          // Why: the reason given (the panel's movements, a mission…), or a donation's memo.
          cell: (tx) => {
            const note = ledgerNote(tx);
            return note ? (
              <span className="line-clamp-2 max-w-64 text-fg-2" title={note}>
                {note}
              </span>
            ) : (
              <span className="text-fg-3">—</span>
            );
          },
        },
        {
          key: 'by',
          header: t('economy.by'),
          // The calling service (`svc-game`…), or the players themselves.
          cell: (tx) =>
            tx.caller ? (
              <MonoText tone="muted">{tx.caller}</MonoText>
            ) : (
              <span className="text-fg-3">{t('economy.byPlayer')}</span>
            ),
        },
      ]}
    />
  );
}
