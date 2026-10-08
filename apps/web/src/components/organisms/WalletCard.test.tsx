import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { organisationIds, socialIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { WalletCard } from './WalletCard';

describe('WalletCard', () => {
  it("shows a player's balance and ledger, read as svc-admin", async () => {
    const bff = useInProcessBff();
    renderWithProviders(<WalletCard holder="players" id={socialIds.reporter} title="Wallet" />);
    const card = screen.getByRole('region', { name: 'Wallet' });

    expect(await within(card).findByText('1,250 credits')).toBeInTheDocument();
    expect(await within(card).findByText('Mission reward')).toBeInTheDocument();
    expect(bff.economie.tokens).toContain('Bearer svc-admin-token');
  });

  it('says when the holder has no account yet', async () => {
    useInProcessBff();
    renderWithProviders(
      <WalletCard holder="corporations" id={organisationIds.logistics} title="Treasury" />,
    );
    expect(await screen.findByText('No account yet in the economie service.')).toBeInTheDocument();
  });
});
