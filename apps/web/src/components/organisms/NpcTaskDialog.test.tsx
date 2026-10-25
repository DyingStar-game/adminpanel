import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { npcIds as ids } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcTaskDialog } from './NpcTaskDialog';

const npc = { id: ids.alain, displayName: 'Alain Deloin' };

describe('NpcTaskDialog', () => {
  it('sends an NPC to a position on its depot, online even off shift', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(<NpcTaskDialog npc={npc} onClose={onClose} />);

    const queue = screen.getByRole('button', { name: 'Queue the task' });
    expect(queue).toBeDisabled();
    await userEvent.type(screen.getByLabelText('x'), '12.5');
    await userEvent.type(screen.getByLabelText('y'), '0');
    await userEvent.type(screen.getByLabelText('z'), '-4');
    await userEvent.type(screen.getByLabelText('Object (UUID)'), ids.m0012Depot);
    await userEvent.type(screen.getByLabelText('Stay (s)'), '30');
    await userEvent.click(screen.getByRole('switch', { name: 'Connect it even off shift' }));
    await userEvent.click(queue);

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.npc.writes).toEqual([
      {
        call: `POST /npcs/${ids.alain}/tasks`,
        body: {
          kind: 'go_to_position',
          params: { position: { x: 12.5, y: 0, z: -4 }, uuid: ids.m0012Depot, hold_s: 30 },
          forceOnline: true,
        },
      },
    ]);
  });

  it('runs an action with config overrides offered from its fields', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<NpcTaskDialog npc={npc} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Task' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Run an action' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Action' }));
    await userEvent.click(await screen.findByRole('option', { name: 'drive_to_factory' }));
    expect(screen.getByText(/destination: string \(e\.g\. F0003\)/)).toBeInTheDocument();
    const config = screen.getByLabelText('Config overrides (JSON)');
    fireEvent.change(config, { target: { value: '[1]' } });
    expect(await screen.findByText('A JSON object is expected.')).toBeInTheDocument();
    fireEvent.change(config, { target: { value: '{"destination": "F0003"}' } });
    await userEvent.type(screen.getByLabelText('For at most (s)'), '600');
    await userEvent.click(screen.getByRole('button', { name: 'Queue the task' }));

    await vi.waitFor(() =>
      expect(bff.npc.writes).toEqual([
        {
          call: `POST /npcs/${ids.alain}/tasks`,
          body: {
            kind: 'run_action',
            params: {
              action: 'drive_to_factory',
              config: { destination: 'F0003' },
              duration_s: 600,
            },
            forceOnline: false,
          },
        },
      ]),
    );
  });

  it('refuses a wait longer than an hour', async () => {
    useInProcessBff();
    renderWithProviders(<NpcTaskDialog npc={npc} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Task' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Wait' }));
    await userEvent.type(screen.getByLabelText('Seconds'), '3601');
    expect(await screen.findByText('Out of range.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Queue the task' })).toBeDisabled();
  });
});
