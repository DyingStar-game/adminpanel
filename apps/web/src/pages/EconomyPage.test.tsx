import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { EconomyPage } from './EconomyPage';

describe('EconomyPage (ADR 0024 step O)', () => {
  it('shows the dashboard of the period and changes it', async () => {
    useInProcessBff();
    const onSearchChange = vi.fn();
    renderWithProviders(
      <EconomyPage
        search={{ days: 30 }}
        onSearchChange={onSearchChange}
        onOpenPlayer={vi.fn()}
        onOpenCorporation={vi.fn()}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Economy' })).toBeInTheDocument();
    expect(await screen.findByText('Volume, 30 days')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Period' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Last 7 days' }));
    expect(onSearchChange).toHaveBeenCalledWith({ days: 7 });
  });
});
