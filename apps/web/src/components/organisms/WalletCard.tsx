import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { Badge } from '@/components/ui/badge';
import { useLedger, useWallet, type WalletHolder } from '@/hooks/useEconomie';
import { formatAmount } from '@/lib/economy';
import { moderationErrorKey } from '@/lib/moderationErrors';
import { MODERATION_PAGE_SIZE } from '@/lib/moderationSearch';
import { LedgerTable } from './LedgerTable';

interface WalletCardProps {
  holder: WalletHolder;
  id: string;
  /** The section's title: wallet, treasury… */
  title: string;
}

/** A holder's balances, one per currency, and their ledger (ADR 0024 step O, as `svc-admin`). */
export function WalletCard({ holder, id, title }: WalletCardProps) {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const wallet = useWallet(holder, id);
  const ledger = useLedger(holder, id, page);
  const accounts = wallet.data?.accounts ?? [];
  const own = new Set(accounts.map((a) => a.id));

  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {wallet.isError ? (
        <ServiceNotice message={t(moderationErrorKey(wallet.error))} />
      ) : wallet.isPending ? (
        <p className="text-sm text-fg-3">…</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-fg-3">{t('economy.noWallet')}</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <span className="text-lg font-semibold tabular-nums">
                  {formatAmount(a.balance, a.currency, i18n.language)}
                </span>
                {a.status !== 'active' && (
                  <Badge variant="destructive">{t(`economy.status.${a.status}`)}</Badge>
                )}
              </li>
            ))}
          </ul>
          <LedgerTable transactions={ledger.data?.items ?? []} own={own} />
          {ledger.data && (
            <Pagination
              page={page}
              pageSize={MODERATION_PAGE_SIZE}
              total={ledger.data.total}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </section>
  );
}
