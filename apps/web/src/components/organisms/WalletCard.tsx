import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pagination } from '@/components/molecules/Pagination';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { movementPermission } from '@dyingstar-admin/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { useLedger, usePoliticalSettings, useWallet, type WalletHolder } from '@/hooks/useEconomie';
import { formatAmount } from '@/lib/economy';
import { moderationErrorKey } from '@/lib/moderationErrors';
import { MODERATION_PAGE_SIZE } from '@/lib/moderationSearch';
import { LedgerTable } from './LedgerTable';
import { MintMoneyDialog } from './MintMoneyDialog';
import { MoneyMovementDialog } from './MoneyMovementDialog';

interface WalletCardProps {
  holder: WalletHolder;
  id: string;
  /** The section's title: wallet, treasury… */
  title: string;
  /** The holder's name, for the movements' summaries. */
  name: string;
  /** A country or a federation: money may be issued into its treasury (`economie`'s README). */
  mintable?: boolean;
}

/**
 * A holder's balances, one per currency, and their ledger (ADR 0024 step O, as `svc-admin`);
 * credit, debit and issue money for the capability roles of `economie`'s README (step O.3).
 */
export function WalletCard({ holder, id, title, name, mintable = false }: WalletCardProps) {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<'credit' | 'debit' | 'mint' | null>(null);
  const wallet = useWallet(holder, id);
  const ledger = useLedger(holder, id, page);
  const issues = holder === 'politics' && mintable && can('economie.moneyIssue');
  const settings = usePoliticalSettings(id, issues);
  const accounts = wallet.data?.accounts ?? [];
  const own = new Set(accounts.map((a) => a.id));
  const balance = accounts.find((a) => a.currency === 'credits')?.balance ?? 0;
  const actions = wallet.data
    ? ([
        can(movementPermission(holder, 'credit')) && 'credit',
        can(movementPermission(holder, 'debit')) && 'debit',
        issues && settings.data && 'mint',
      ].filter(Boolean) as ('credit' | 'debit' | 'mint')[])
    : [];

  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button key={action} variant="outline" size="sm" onClick={() => setDialog(action)}>
                {t(`economy.actions.${action}`)}
              </Button>
            ))}
          </div>
        )}
      </div>
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
      {(dialog === 'credit' || dialog === 'debit') && (
        <MoneyMovementDialog
          holder={holder}
          target={{ id, name }}
          direction={dialog}
          balance={balance}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'mint' && settings.data && (
        <MintMoneyDialog
          entity={{ id, name }}
          settings={settings.data}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
