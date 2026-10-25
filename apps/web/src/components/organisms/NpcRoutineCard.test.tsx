import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { npcIds as ids } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useNpc } from '@/hooks/useNpcs';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcRoutineCard } from './NpcRoutineCard';

function Routine({
  id,
  onEditPattern = vi.fn(),
}: {
  id: string;
  onEditPattern?: (n: string) => void;
}) {
  const npc = useNpc(id);
  return npc.data ? <NpcRoutineCard detail={npc.data} onEditPattern={onEditPattern} /> : null;
}

describe('NpcRoutineCard', () => {
  it('outlines the cell of now on the week and lists the actions allowed', async () => {
    useInProcessBff();
    const onEditPattern = vi.fn();
    renderWithProviders(<Routine id={ids.alain} onEditPattern={onEditPattern} />);

    // Day 8 of the rota (index 7) on a 5-day pattern: its third day, hour 6.
    // Named once the legend is read (by label: role queries are slow on a 125-cell grid).
    const now = await screen.findByLabelText('Day 3, hour 6: travail', {}, { timeout: 5000 });
    expect(now).toHaveAttribute('aria-current', 'time');
    expect(screen.getByText('Activity now').nextElementSibling).toHaveTextContent('Work');
    expect(screen.getByText('Actions allowed now').nextElementSibling).toHaveTextContent(
      'depot_store_item',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit the pattern' }));
    expect(onEditPattern).toHaveBeenCalledWith('magasinier_1');
  });

  it('clears the pattern', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<Routine id={ids.camille} />);

    await userEvent.click(await screen.findByRole('combobox', { name: 'Shift pattern' }));
    await userEvent.click(await screen.findByRole('option', { name: 'No pattern (no schedule)' }));
    await vi.waitFor(() =>
      expect(bff.npc.writes).toEqual([
        { call: `PATCH /npcs/${ids.camille}`, body: { schedulePattern: null } },
      ]),
    );
    expect(
      await screen.findByText('No pattern: the NPC is not gated by a schedule.'),
    ).toBeInTheDocument();
  });

  it('shows the pattern without a selector to a moderator', async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['npc.view']}>
        <Routine id={ids.alain} />
      </PermissionsContext.Provider>,
    );

    await screen.findByRole('grid');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
