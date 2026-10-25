import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { ScheduleImportDialog } from './ScheduleImportDialog';

describe('ScheduleImportDialog', () => {
  it("imports the service's file, overwriting, and shows the report", async () => {
    const bff = useInProcessBff();
    renderWithProviders(<ScheduleImportDialog onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Mode' }));
    await userEvent.click(await screen.findByRole('option', { name: /Overwrite/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));

    const list = await screen.findByLabelText('Import report');
    expect(within(list).getByText('2 updated').nextSibling).toHaveTextContent(
      'magasinier_1, magasinier_2',
    );
    expect(bff.npc.writes).toEqual([
      { call: 'POST /schedule/import', body: { mode: 'overwrite' } },
    ]);
  });

  it('imports pasted YAML and lists the refused patterns', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<ScheduleImportDialog onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Source' }));
    await userEvent.click(await screen.findByRole('option', { name: 'YAML pasted below' }));
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('YAML'), {
      target: {
        value: 'schedules:\n  early:\n    days:\n      - "TT.."\n  Bad:\n    days:\n      - "T"\n',
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Import' }));

    const list = await screen.findByLabelText('Import report');
    expect(within(list).getByText('1 created').nextSibling).toHaveTextContent('early');
    expect(within(list).getByText('1 refused').nextSibling).toHaveTextContent(
      "pattern name 'Bad' must match",
    );
    expect(bff.npc.data.patterns.map((p) => p.name)).toContain('early');
  });
});
