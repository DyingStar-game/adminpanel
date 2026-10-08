import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { socialIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { PlayerRecordPage } from './PlayerRecordPage';

const renderPage = (playerId: string) =>
  renderWithProviders(
    <PlayerRecordPage
      playerId={playerId}
      onBack={vi.fn()}
      onOpenPlayer={vi.fn()}
      onOpenReport={vi.fn()}
    />,
  );

describe('PlayerRecordPage (ADR 0024)', () => {
  it("shows a player's reputation, sanctions and the reports against them", async () => {
    useInProcessBff();
    renderPage(socialIds.griefer);

    expect(await screen.findByRole('heading', { name: 'griefer42' })).toBeInTheDocument();
    expect(screen.getByText('Reputation', { selector: 'dt' }).nextSibling).toHaveTextContent('-27');
    const sanctions = screen.getByRole('table', { name: 'Sanctions' });
    expect(within(sanctions).getByText('Warning')).toBeInTheDocument();
    const reports = screen.getByRole('table', { name: 'Reports against them' });
    expect(within(reports).getByText('Griefing')).toBeInTheDocument();
  });

  it('says when social does not know the player', async () => {
    useInProcessBff();
    renderPage('5b1d3c1e-0000-4000-8000-0000000000ff');

    expect(await screen.findByRole('alert')).toHaveTextContent('No player');
  });
});
