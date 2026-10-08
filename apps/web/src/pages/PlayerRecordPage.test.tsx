import { afterEach, describe, expect, it, vi } from 'vitest';
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

afterEach(() => vi.useRealTimers());

describe('PlayerRecordPage (ADR 0024)', () => {
  it('shows the sanction in force, presence, identity and organisations', async () => {
    // The fixtures' mute ends on 2026-10-09 10:40 UTC.
    vi.useFakeTimers({ now: Date.parse('2026-10-08T12:00:00.000Z'), shouldAdvanceTime: true });
    useInProcessBff();
    renderPage(socialIds.griefer);

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(/Mute until .* Reputation below -25/);
    expect(banner).toHaveTextContent(/Warning permanent — Griefing at the spawn/);
    expect(await screen.findByText('Online')).toBeInTheDocument();
    expect(screen.getByText('Free miners')).toBeInTheDocument();
    expect(screen.getByText('Grif')).toBeInTheDocument();
    expect(screen.getByText('Left the guild after a duel.')).toBeInTheDocument();
    expect(await screen.findByText('Deep Core Mining')).toBeInTheDocument();
    expect(screen.getByText('Port Gaea')).toBeInTheDocument();
  });

  it('shows no banner without a sanction in force', async () => {
    useInProcessBff();
    renderPage(socialIds.reporter);

    await screen.findByRole('heading', { name: 'ddurieux' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

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
