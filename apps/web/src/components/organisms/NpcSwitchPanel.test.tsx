import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcSwitchPanel } from './NpcSwitchPanel';

describe('NpcSwitchPanel', () => {
  it('shows the counts and turns the NPCs off after confirmation', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<NpcSwitchPanel />);

    const toggle = await screen.findByRole('switch', { name: 'NPCs on the servers: on' });
    expect(screen.getByText('Connected').nextSibling).toHaveTextContent('2');
    expect(screen.getByText('Total').nextSibling).toHaveTextContent('5');
    await userEvent.click(toggle);
    const dialog = screen.getByRole('alertdialog', { name: 'Turn the NPCs off?' });
    expect(dialog).toHaveTextContent('3 enabled NPCs');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn off' }));

    await vi.waitFor(() =>
      expect(bff.npc.writes).toEqual([{ call: 'PUT /settings', body: { npcsEnabled: false } }]),
    );
    expect(
      await screen.findByRole('switch', { name: 'NPCs on the servers: off' }),
    ).not.toBeChecked();
  });

  it('shows the switch to a moderator without letting them use it', async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['npc.view']}>
        <NpcSwitchPanel />
      </PermissionsContext.Provider>,
    );

    expect(await screen.findByRole('switch')).toBeDisabled();
  });
});
