import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModerationSearchSchema, type ModerationSearch } from '@/lib/moderationSearch';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { ReportsPanel } from './ReportsPanel';

const renderPanel = (search: Partial<ModerationSearch>) => {
  const onSearchChange = vi.fn();
  renderWithProviders(
    <ReportsPanel
      search={ModerationSearchSchema.parse({ tab: 'reports', ...search })}
      onSearchChange={onSearchChange}
      onOpenPlayer={vi.fn()}
    />,
  );
  return { onSearchChange };
};

describe('ReportsPanel', () => {
  it('lists the reports of the filter in the URL', async () => {
    useInProcessBff();
    renderPanel({ status: 'open' });

    await screen.findByText('Griefing');
    const table = screen.getByRole('table', { name: 'Reports' });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
  });

  it('opens a report and closes it', async () => {
    useInProcessBff();
    const { onSearchChange } = renderPanel({ report: 3 });

    const report = await screen.findByRole('region', { name: 'Report #3' });
    expect(within(report).getByText('He keeps reporting me.')).toBeInTheDocument();
    expect(within(report).getByText(/Retaliation report\./)).toBeInTheDocument();
    await userEvent.click(within(report).getByRole('button', { name: 'Close the report' }));
    expect(onSearchChange).toHaveBeenCalledWith(expect.objectContaining({ report: undefined }));
  });
});
