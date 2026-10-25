import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { zNpc } from '@dyingstar-admin/contracts/npc';
import { createNpcDataset, npcIds as ids } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcConfigForm } from './NpcConfigForm';

const data = createNpcDataset();
const npcOf = (id: string) => {
  const npc = data.npcs.find((n) => n.id === id);
  if (!npc) throw new Error('fixture missing');
  // As the SPA reads it (its `int64` ids as `bigint`).
  return zNpc.parse(npc);
};

describe('NpcConfigForm', () => {
  it('sends only the fields changed: names, profile, a place, the action config', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<NpcConfigForm npc={npcOf(ids.denis)} />);

    const save = screen.getByRole('button', { name: 'Save the configuration' });
    expect(save).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('First name'));
    await userEvent.type(screen.getByLabelText('First name'), 'Dany');
    await userEvent.click(await screen.findByRole('button', { name: 'take_a_walk' }));
    await vi.waitFor(() => expect(save).toBeEnabled());
    // A place needs its three coordinates once its object is given.
    await userEvent.type(screen.getByLabelText('Object UUID of Home'), ids.m0012Depot);
    await vi.waitFor(() => expect(save).toBeDisabled());
    await userEvent.type(screen.getByLabelText('Home x'), '1');
    await userEvent.type(screen.getByLabelText('Home y'), '0');
    await userEvent.type(screen.getByLabelText('Home z'), '-2.5');
    const config = screen.getByLabelText('Action config (JSON)');
    fireEvent.change(config, { target: { value: '{"take_a_walk": ' } });
    expect(await screen.findByText('A JSON object is expected.')).toBeInTheDocument();
    fireEvent.change(config, { target: { value: '{"take_a_walk": {"radius_m": 20}}' } });
    expect(await screen.findByText('4 changes')).toBeInTheDocument();
    await userEvent.click(save);

    await vi.waitFor(() =>
      expect(bff.npc.writes).toEqual([
        {
          call: `PATCH /npcs/${ids.denis}`,
          body: {
            firstName: 'Dany',
            actionProfile: ['take_a_walk'],
            home: { uuid: ids.m0012Depot, position: { x: 1, y: 0, z: -2.5 } },
            actionConfig: { take_a_walk: { radius_m: 20 } },
          },
        },
      ]),
    );
  }, 20_000);

  it("shows the service's refusal", async () => {
    useInProcessBff();
    renderWithProviders(<NpcConfigForm npc={npcOf(ids.denis)} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Role' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Storekeeper' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save the configuration' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'a storekeeper needs villageCode and storekeeperSlot',
    );
  });

  it('clears a place and the pattern', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<NpcConfigForm npc={npcOf(ids.alain)} />);

    await userEvent.click(screen.getByRole('button', { name: 'Clear Workplace' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Shift pattern' }));
    await userEvent.click(await screen.findByRole('option', { name: 'No pattern (no schedule)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save the configuration' }));

    await vi.waitFor(() =>
      expect(bff.npc.writes).toEqual([
        {
          call: `PATCH /npcs/${ids.alain}`,
          body: { schedulePattern: null, placeWhereWork: null },
        },
      ]),
    );
  });

  it('is read only for a moderator', () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['npc.view']}>
        <NpcConfigForm npc={npcOf(ids.alain)} />
      </PermissionsContext.Provider>,
    );

    expect(screen.getByLabelText('First name')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Save the configuration' }),
    ).not.toBeInTheDocument();
  });
});
