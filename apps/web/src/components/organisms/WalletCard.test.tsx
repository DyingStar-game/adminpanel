import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { organisationIds, socialIds } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { WalletCard } from './WalletCard';

describe('WalletCard', () => {
  it("shows a player's balance and ledger, read as svc-admin", async () => {
    const bff = useInProcessBff();
    renderWithProviders(
      <WalletCard holder="players" id={socialIds.reporter} title="Wallet" name="ddurieux" />,
    );
    const card = screen.getByRole('region', { name: 'Wallet' });

    expect(await within(card).findByText('1,250 credits')).toBeInTheDocument();
    expect(await within(card).findByText('Mission reward')).toBeInTheDocument();
    expect(bff.economie.tokens).toContain('Bearer svc-admin-token');
  });

  it('says when the holder has no account yet', async () => {
    useInProcessBff();
    renderWithProviders(
      <WalletCard
        holder="corporations"
        id={organisationIds.logistics}
        title="Treasury"
        name="DCM Logistics"
      />,
    );
    expect(await screen.findByText('No account yet in the economie service.')).toBeInTheDocument();
  });

  it("offers credit and debit to economie's capability roles only (step O.3)", async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['economie.walletRead', 'economie.walletCredit']}>
        <WalletCard holder="players" id={socialIds.reporter} title="Wallet" name="ddurieux" />
      </PermissionsContext.Provider>,
    );
    const card = screen.getByRole('region', { name: 'Wallet' });

    await userEvent.click(await within(card).findByRole('button', { name: 'Credit' }));
    expect(within(card).queryByRole('button', { name: 'Debit' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Credit ddurieux' })).toBeInTheDocument();
  });

  it("offers money issuing on a country's treasury, to economie:money:issue", async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['economie.politicsRead', 'economie.moneyIssue']}>
        <WalletCard
          holder="politics"
          id={organisationIds.country}
          title="Treasury"
          name="Tarsis Union"
          mintable
        />
      </PermissionsContext.Provider>,
    );
    const card = screen.getByRole('region', { name: 'Treasury' });

    expect(await within(card).findByRole('button', { name: 'Issue money' })).toBeInTheDocument();
    // A political treasury's movements are economie:politics:manage's.
    expect(within(card).queryByRole('button', { name: 'Credit' })).toBeNull();
  });
});
