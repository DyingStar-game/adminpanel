import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MissionsSearchSchema, type MissionsSearch } from '@/lib/missionsSearch';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { MissionsPage } from './MissionsPage';

const renderPage = (search: Partial<MissionsSearch> = {}) => {
  const onSearchChange = vi.fn();
  renderWithProviders(
    <MissionsPage
      search={MissionsSearchSchema.parse(search)}
      onSearchChange={onSearchChange}
      onOpenMission={vi.fn()}
    />,
  );
  return onSearchChange;
};

describe('MissionsPage (ADR 0024 step O)', () => {
  it('lists every mission, any status', async () => {
    useInProcessBff();
    renderPage();

    const table = await screen.findByRole('table', { name: 'Missions' });
    expect(await within(table).findByText('Buy my spare battery')).toBeInTheDocument();
    expect(within(table).getByText('The first survey')).toBeInTheDocument();
    expect(screen.getByText('1–5 of 5')).toBeInTheDocument();
  });

  it('filters by status from the URL, and goes back to the first page on a change', async () => {
    useInProcessBff();
    const onSearchChange = renderPage({ status: 'completed', page: 1 });

    const table = await screen.findByRole('table', { name: 'Missions' });
    expect(await within(table).findByText('The first survey')).toBeInTheDocument();
    expect(within(table).queryByText('Iron ore for New Haven')).toBeNull();

    await userEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    // The five categories `mission` accepts, not the ones older missions carry.
    expect(screen.queryByRole('option', { name: 'Combat' })).toBeNull();
    await userEvent.click(await screen.findByRole('option', { name: 'Miscellaneous' }));
    expect(onSearchChange).toHaveBeenCalledWith({
      status: 'completed',
      category: 'divers',
      page: 1,
    });
  });
});
