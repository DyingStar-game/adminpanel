import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { npcIds as ids } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcLogs } from './NpcLogs';

describe('NpcLogs', () => {
  it('shows the log lines with their fields, then only the warnings', async () => {
    useInProcessBff();
    renderWithProviders(<NpcLogs npcId={ids.alain} />);

    const list = await screen.findByRole('list', { name: 'Log lines' });
    const warning = await within(list).findByText(/shelf full/);
    expect(warning).toHaveTextContent('shelf=B2');
    expect(within(list).getByText(/action started/)).toHaveTextContent('action=depot_store_item');
    expect(screen.getByText('4 lines')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: 'Level' }));
    await userEvent.click(await screen.findByRole('option', { name: 'warn and above' }));
    expect(await screen.findByText('1 line')).toBeInTheDocument();
    expect(within(list).queryByText(/action started/)).not.toBeInTheDocument();
  });

  it('appends the new lines and empties the view on demand', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<NpcLogs npcId={ids.alain} />);

    const list = await screen.findByRole('list', { name: 'Log lines' });
    await within(list).findByText(/shelf full/);
    await userEvent.click(screen.getByRole('button', { name: 'Clear the view' }));
    expect(screen.getByText('No log line yet.')).toBeInTheDocument();
    bff.npc.data.logs.get(ids.alain)?.push({
      seq: 9,
      ts: new Date().toISOString(),
      level: 'ERROR',
      target: 'npc::runtime',
      message: 'lost the Horizon session',
      fields: {},
    });
    // The next poll (3 s) brings the new line only.
    expect(
      await within(list).findByText(/lost the Horizon session/, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 line')).toBeInTheDocument();
  }, 10_000);
});
