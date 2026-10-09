import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { socialIds } from '@dyingstar-admin/testing';
import { PlayersSearchSchema, type PlayersSearch } from '@/lib/playersSearch';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { PlayersPage } from './PlayersPage';

const renderPage = (search: Partial<PlayersSearch> = {}) => {
  const onSearchChange = vi.fn();
  const onOpenPlayer = vi.fn();
  renderWithProviders(
    <PlayersPage
      search={PlayersSearchSchema.parse(search)}
      onSearchChange={onSearchChange}
      onOpenPlayer={onOpenPlayer}
    />,
  );
  return { onSearchChange, onOpenPlayer };
};

describe('PlayersPage (ADR 0024)', () => {
  it('lists players by name and opens a sheet', async () => {
    useInProcessBff();
    const { onOpenPlayer } = renderPage();

    const table = await screen.findByRole('table', { name: 'Players' });
    await within(table).findByText('griefer42');
    const names = within(table).getAllByRole('row');
    expect(names.slice(1).map((row) => row.firstChild?.textContent)).toEqual([
      'ddurieux',
      'dev-moderator',
      'griefer42',
    ]);

    await userEvent.click(within(table).getByText('griefer42'));
    expect(onOpenPlayer).toHaveBeenCalledWith(socialIds.griefer);
  });

  it('shows the players matching the name in the URL', async () => {
    useInProcessBff();
    renderPage({ q: 'grief' });

    const table = await screen.findByRole('table', { name: 'Players' });
    expect(await within(table).findByText('griefer42')).toBeInTheDocument();
    expect(within(table).queryByText('ddurieux')).not.toBeInTheDocument();
  });

  it('sends the typed name once the user pauses', async () => {
    useInProcessBff();
    const { onSearchChange } = renderPage();

    await userEvent.type(screen.getByRole('textbox', { name: 'Search by name' }), 'dev');

    await vi.waitFor(() =>
      expect(onSearchChange).toHaveBeenCalledWith(expect.objectContaining({ q: 'dev', page: 1 })),
    );
  });
});
