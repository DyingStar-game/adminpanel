import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './DataTable';

const rows = [
  { id: 1, name: 'griefer42', reputation: -27 },
  { id: 2, name: 'ddurieux', reputation: 3 },
];
const columns = [
  { key: 'name', header: 'Name', cell: (r: (typeof rows)[number]) => r.name },
  { key: 'rep', header: 'Reputation', cell: (r: (typeof rows)[number]) => r.reputation },
];

describe('DataTable', () => {
  it('renders headers and a row per record, and picks one', async () => {
    const onPick = vi.fn();
    render(
      <DataTable
        label="Players"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        empty="None"
        onPick={onPick}
        picked={(r) => r.id === 2}
      />,
    );
    const table = screen.getByRole('table', { name: 'Players' });

    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Name', 'Reputation']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('ddurieux').closest('tr')).toHaveAttribute('aria-selected');

    await userEvent.click(within(table).getByText('griefer42'));
    expect(onPick).toHaveBeenCalledWith(rows[0]);
  });

  it('says when there is nothing', () => {
    render(
      <DataTable label="Players" columns={columns} rows={[]} rowKey={(r) => r.id} empty="None" />,
    );
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('keeps the cells across renders (no remount)', () => {
    const { rerender } = render(
      <DataTable
        label="Players"
        columns={[...columns]}
        rows={rows}
        rowKey={(r) => r.id}
        empty="None"
      />,
    );
    const cell = screen.getByText('griefer42');
    // New column objects and renderers, as a parent re-rendering gives.
    rerender(
      <DataTable
        label="Players"
        columns={[...columns]}
        rows={[...rows]}
        rowKey={(r) => r.id}
        empty="None"
      />,
    );
    expect(screen.getByText('griefer42')).toBe(cell);
  });
});
