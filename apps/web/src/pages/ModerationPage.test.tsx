import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { socialIds } from '@dyingstar-admin/testing';
import { ModerationSearchSchema, type ModerationSearch } from '@/lib/moderationSearch';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { ModerationPage } from './ModerationPage';

const renderPage = (search: Partial<ModerationSearch> = {}) => {
  const onSearchChange = vi.fn();
  const onOpenPlayer = vi.fn();
  renderWithProviders(
    <ModerationPage
      search={ModerationSearchSchema.parse(search)}
      onSearchChange={onSearchChange}
      onOpenPlayer={onOpenPlayer}
    />,
  );
  return { onSearchChange, onOpenPlayer };
};

describe('ModerationPage (ADR 0024)', () => {
  it('shows the community figures and the moderation log', async () => {
    useInProcessBff();
    renderPage();

    expect(await screen.findByText('Active sanctions')).toBeInTheDocument();
    const log = screen.getByRole('table', { name: 'Moderation log' });
    expect(await within(log).findByText('Report dismissed')).toBeInTheDocument();
    expect(within(log).getByText('Sanction given')).toBeInTheDocument();
    expect(within(log).getByText('Warning')).toBeInTheDocument();
    expect(within(log).getByText('« Griefing at the spawn »')).toBeInTheDocument();
    expect(within(log).getByText('Retaliation report.')).toBeInTheDocument();
  });

  it('names the players of the log and opens the report concerned', async () => {
    useInProcessBff();
    const { onSearchChange } = renderPage();

    const log = await screen.findByRole('table', { name: 'Moderation log' });
    // Actor and target by name, once their profiles are read.
    expect(await within(log).findAllByRole('button', { name: 'dev-moderator' })).toHaveLength(2);
    expect(within(log).getByRole('button', { name: 'griefer42' })).toBeInTheDocument();

    await userEvent.click(within(log).getByRole('button', { name: 'Report #3' }));
    expect(onSearchChange).toHaveBeenCalledWith(
      expect.objectContaining({ tab: 'reports', report: 3 }),
    );
  });

  it('opens a player sheet from the lowest reputation list', async () => {
    useInProcessBff();
    const { onOpenPlayer } = renderPage();

    await userEvent.click(await screen.findByRole('cell', { name: 'griefer42' }));

    expect(onOpenPlayer).toHaveBeenCalledWith(socialIds.griefer);
  });

  it('lists reports with names and opens one', async () => {
    useInProcessBff();
    const { onSearchChange } = renderPage({ tab: 'reports' });

    const table = await screen.findByRole('table', { name: 'Reports' });
    expect(await within(table).findByText('Reputation threshold')).toBeInTheDocument();
    // Target of reports 1 and 2, reporter of report 3: each a way to the player sheet.
    expect(within(table).getAllByRole('button', { name: 'griefer42' })).toHaveLength(3);

    await userEvent.click(within(table).getByText('Griefing'));
    expect(onSearchChange).toHaveBeenCalledWith(expect.objectContaining({ report: 1 }));
  });

  it('shows the report opened in the URL', async () => {
    useInProcessBff();
    renderPage({ tab: 'reports', report: 1 });

    const report = await screen.findByRole('region', { name: 'Report #1' });
    expect(within(report).getByText('Blew up my truck at the spawn.')).toBeInTheDocument();
  });

  it('lists active sanctions', async () => {
    useInProcessBff();
    renderPage({ tab: 'sanctions' });

    const table = await screen.findByRole('table', { name: 'Sanctions' });
    expect(await within(table).findByText('Warning')).toBeInTheDocument();
    expect(within(table).getByText('Mute')).toBeInTheDocument();
    expect(within(table).getByText('(automatic)')).toBeInTheDocument();
  });

  it("says so when social refuses the account's role", async () => {
    useInProcessBff();
    server.use(
      http.get('*/api/social/stats', () =>
        HttpResponse.json({ error: 'FORBIDDEN', message: 'Requires moderator' }, { status: 403 }),
      ),
    );
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('may not moderate');
  });
});
