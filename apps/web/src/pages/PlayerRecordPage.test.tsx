import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ids, socialIds } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { PlayerRecordPage } from './PlayerRecordPage';

const renderPage = (playerId: string) => {
  const onOpenItem = vi.fn();
  const onOpenMap = vi.fn();
  renderWithProviders(
    <PlayerRecordPage
      playerId={playerId}
      onBack={vi.fn()}
      onOpenPlayer={vi.fn()}
      onOpenReport={vi.fn()}
      onOpenItem={onOpenItem}
      onOpenMap={onOpenMap}
    />,
  );
  return { onOpenItem, onOpenMap };
};

afterEach(() => vi.useRealTimers());

describe('PlayerRecordPage (ADR 0024)', () => {
  it('shows the sanction in force, presence, identity and organisations', async () => {
    // The fixtures' mute ends on 2026-10-09 10:40 UTC.
    vi.useFakeTimers({ now: Date.parse('2026-10-08T12:00:00.000Z'), shouldAdvanceTime: true });
    useInProcessBff();
    renderPage(socialIds.griefer);

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(/Mute until .* Reputation below -25/);
    // A warning is a record, never in force (social ends it at once).
    expect(banner).not.toHaveTextContent('Warning');
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

  it('opens the player in persistence and on the map: same id as in social', async () => {
    useInProcessBff();
    const { onOpenItem, onOpenMap } = renderPage(socialIds.reporter);

    await userEvent.click(await screen.findByRole('button', { name: 'View in persistence' }));
    expect(onOpenItem).toHaveBeenCalledWith(socialIds.reporter);
    await userEvent.click(await screen.findByRole('button', { name: 'Show on map' }));
    expect(onOpenMap).toHaveBeenCalledWith(ids.planet, socialIds.reporter);
  });

  it('says when persistence has no item for the player', async () => {
    useInProcessBff();
    renderPage(socialIds.griefer);

    expect(await screen.findByText(/No player item with this id/)).toBeInTheDocument();
  });

  describe('acting on the player (step 3)', () => {
    const renderAs = (permissions: string[], playerId: string = socialIds.reporter) =>
      renderWithProviders(
        <PermissionsContext.Provider value={permissions}>
          <PlayerRecordPage
            playerId={playerId}
            onBack={vi.fn()}
            onOpenPlayer={vi.fn()}
            onOpenReport={vi.fn()}
            onOpenItem={vi.fn()}
            onOpenMap={vi.fn()}
          />
        </PermissionsContext.Provider>,
      );

    it('warns a player after a confirmation, and shows it at once', async () => {
      const bff = useInProcessBff();
      renderAs(['social.moderate']);

      await userEvent.click(await screen.findByRole('button', { name: 'Sanction' }));
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
      await userEvent.type(within(dialog).getByLabelText('Reason'), 'Spam in chat');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        'Warning for ddurieux, One-off: “Spam in chat”',
      );
      expect(bff.social.writes).toHaveLength(0);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

      // Kept in the record, nothing in force: no banner, nothing to lift.
      const sanctions = await screen.findByRole('table', { name: 'Sanctions' });
      expect(await within(sanctions).findByText('Spam in chat')).toBeInTheDocument();
      expect(within(sanctions).getByText('One-off')).toBeInTheDocument();
      expect(within(sanctions).queryByRole('button', { name: 'Lift' })).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(bff.social.writes).toEqual([
        {
          call: `POST /players/${socialIds.reporter}/sanctions`,
          body: { type: 'warning', reason: 'Spam in chat', durationHours: null },
        },
      ]);
    });

    it('mutes a player for a duration: in force at once, and liftable', async () => {
      const bff = useInProcessBff();
      renderAs(['social.moderate']);

      await userEvent.click(await screen.findByRole('button', { name: 'Sanction' }));
      const dialog = screen.getByRole('dialog');
      const [typeSelect] = within(dialog).getAllByRole('combobox');
      if (!typeSelect) throw new Error('no type select');
      await userEvent.click(typeSelect);
      await userEvent.click(screen.getByRole('option', { name: 'Mute' }));
      const [, durationSelect] = within(dialog).getAllByRole('combobox');
      if (!durationSelect) throw new Error('no duration select');
      await userEvent.click(durationSelect);
      await userEvent.click(screen.getByRole('option', { name: '24 hours' }));
      await userEvent.type(within(dialog).getByLabelText('Reason'), 'Insults');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

      expect(await screen.findByRole('status')).toHaveTextContent(/Mute until .* — Insults/);
      expect(bff.social.writes[0]?.body).toEqual({
        type: 'mute',
        reason: 'Insults',
        durationHours: 24,
      });
      const sanctions = screen.getByRole('table', { name: 'Sanctions' });
      expect(within(sanctions).getByRole('button', { name: 'Lift' })).toBeInTheDocument();
    });

    it('asks no duration for a warning', async () => {
      useInProcessBff();
      renderAs(['social.moderate']);

      await userEvent.click(await screen.findByRole('button', { name: 'Sanction' }));
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getAllByRole('combobox')).toHaveLength(1);
      expect(within(dialog).getByText(/has no duration/)).toBeInTheDocument();
    });

    it('offers suspensions, bans and reputation to admins only', async () => {
      useInProcessBff();
      renderAs(['social.moderate']);
      await screen.findByRole('button', { name: 'Sanction' });
      expect(screen.queryByRole('button', { name: 'Adjust reputation' })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Sanction' }));
      const [typeSelect] = within(screen.getByRole('dialog')).getAllByRole('combobox');
      if (!typeSelect) throw new Error('no type select');
      await userEvent.click(typeSelect);
      const options = screen.getAllByRole('option').map((o) => o.textContent);
      expect(options).toEqual(['Warning', 'Mute']);
    });

    it('adjusts reputation after a confirmation', async () => {
      const bff = useInProcessBff();
      renderAs(['social.moderate', 'social.sanctionSevere', 'social.reputation']);

      await userEvent.click(await screen.findByRole('button', { name: 'Adjust reputation' }));
      const dialog = screen.getByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText('Change'), '-5');
      await userEvent.type(within(dialog).getByLabelText('Reason'), 'Insults');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
      expect(within(dialog).getByRole('alert')).toHaveTextContent('-5 for ddurieux (3 → -2)');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

      await vi.waitFor(() =>
        expect(screen.getByText('Reputation', { selector: 'dt' }).nextSibling).toHaveTextContent(
          '-2',
        ),
      );
      expect(bff.social.writes.map((w) => w.call)).toEqual([
        `POST /players/${socialIds.reporter}/reputation`,
      ]);
    });

    it('lifts a sanction in force after a confirmation', async () => {
      const bff = useInProcessBff();
      renderAs(['social.moderate'], socialIds.griefer);

      const sanctions = await screen.findByRole('table', { name: 'Sanctions' });
      const [first] = within(sanctions).getAllByRole('button', { name: 'Lift' });
      if (!first) throw new Error('no sanction to lift');
      await userEvent.click(first);
      await userEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Lift' }),
      );

      await vi.waitFor(() => expect(bff.social.writes.map((w) => w.call)).toHaveLength(1));
      expect(bff.social.writes[0]?.call).toMatch(/^DELETE \/sanctions\/\d+$/);
    });

    it('offers no action to an account that may not moderate', async () => {
      useInProcessBff();
      renderAs(['persistence.read']);

      await screen.findByRole('heading', { name: 'ddurieux' });
      expect(screen.queryByRole('button', { name: 'Sanction' })).not.toBeInTheDocument();
    });
  });
});
