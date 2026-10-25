import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createNpcDataset } from '@dyingstar-admin/testing';
import { Toaster } from '@/components/ui/sonner';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcPatternEditor } from './NpcPatternEditor';

const letters = [
  { letter: 'T', activity: 'work', label: 'travail' },
  { letter: 'r', activity: 'meal', label: 'repas' },
  { letter: '.', activity: 'off', label: 'repos (maison)' },
];
const data = createNpcDataset();

describe('NpcPatternEditor', () => {
  it('creates a pattern painted on the grid', async () => {
    const bff = useInProcessBff();
    const onSaved = vi.fn();
    renderWithProviders(
      <NpcPatternEditor
        pattern={null}
        letters={letters}
        hours={4}
        onSaved={onSaved}
        onDeleted={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText('Name'), 'Night Crew');
    expect(await screen.findByText(/lower-case letters, digits/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'night_crew');
    const grid = screen.getByRole('grid', { name: 'Shift grid' });
    await userEvent.click(
      within(grid).getByRole('gridcell', { name: 'Day 1, hour 0: repos (maison)' }),
    );
    await userEvent.click(
      within(grid).getByRole('gridcell', { name: 'Day 1, hour 1: repos (maison)' }),
    );
    await userEvent.click(screen.getByRole('button', { name: /repas/ }));
    await userEvent.click(
      within(grid).getByRole('gridcell', { name: 'Day 1, hour 2: repos (maison)' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add a day' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save the pattern' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith('night_crew'));
    expect(bff.npc.writes).toEqual([
      { call: 'POST /schedule/patterns', body: { name: 'night_crew', days: ['TTr.', 'TTr.'] } },
    ]);
  });

  it('changes a cell of an existing pattern, and is read only for a moderator', async () => {
    const bff = useInProcessBff();
    const pattern = data.patterns[1];
    if (!pattern) throw new Error('fixture missing');
    const { unmount } = renderWithProviders(
      <NpcPatternEditor
        pattern={pattern}
        letters={letters}
        hours={25}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('gridcell', { name: 'Day 1, hour 0: repos (maison)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save the pattern' }));
    await vi.waitFor(() => expect(bff.npc.writes).toHaveLength(1));
    expect(bff.npc.writes[0]).toMatchObject({ call: 'PUT /schedule/patterns/magasinier_2' });
    expect((bff.npc.writes[0]?.body as { days: string[] }).days[0]).toBe(
      'T...tTTTTTaaratTTTTTaar..',
    );
    unmount();

    renderWithProviders(
      <PermissionsContext.Provider value={['npc.view']}>
        <NpcPatternEditor
          pattern={pattern}
          letters={letters}
          hours={25}
          onSaved={vi.fn()}
          onDeleted={vi.fn()}
        />
      </PermissionsContext.Provider>,
    );
    expect(screen.getByRole('grid', { name: 'Shift grid' })).toHaveAttribute(
      'aria-readonly',
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Save the pattern' })).not.toBeInTheDocument();
  });

  it('says why a used pattern cannot be deleted', async () => {
    useInProcessBff();
    const pattern = data.patterns[0];
    if (!pattern) throw new Error('fixture missing');
    renderWithProviders(
      <>
        <NpcPatternEditor
          pattern={pattern}
          letters={letters}
          hours={25}
          onSaved={vi.fn()}
          onDeleted={vi.fn()}
        />
        <Toaster />
      </>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Delete the pattern' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete magasinier_1?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete the pattern' }));
    expect(
      await screen.findByText("pattern 'magasinier_1' is used by 2 NPC(s)"),
    ).toBeInTheDocument();
  });
});
