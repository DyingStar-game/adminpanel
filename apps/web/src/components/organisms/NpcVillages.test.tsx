import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcVillages } from './NpcVillages';

describe('NpcVillages', () => {
  it('lists the mining villages with their storekeepers, workplace and Factory', async () => {
    useInProcessBff();
    const onOpenVillage = vi.fn();
    renderWithProviders(<NpcVillages onOpenVillage={onOpenVillage} />);

    const table = await screen.findByRole('table', { name: 'Mining villages' });
    const m0012 = await within(table).findByRole('row', { name: /M0012/ });
    expect(m0012).toHaveTextContent('2/5');
    expect(m0012).toHaveTextContent('M0012-D1');
    expect(m0012).toHaveTextContent('Universe simulation');
    expect(m0012).toHaveTextContent('F0003 · 15 km');
    expect(within(table).getByRole('row', { name: /M0013/ })).toHaveTextContent('Not resolved yet');
    await userEvent.click(within(m0012).getByRole('button', { name: 'NPCs of M0012' }));
    expect(onOpenVillage).toHaveBeenCalledWith('M0012');
  });

  it('opens the workplace dialog for npc.manage only', async () => {
    useInProcessBff();
    const { unmount } = renderWithProviders(<NpcVillages onOpenVillage={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Workplace of M0013' }));
    expect(screen.getByRole('dialog', { name: 'Workplace of M0013' })).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <PermissionsContext.Provider value={['npc.view']}>
        <NpcVillages onOpenVillage={vi.fn()} />
      </PermissionsContext.Provider>,
    );
    await screen.findByRole('row', { name: /M0013/ });
    expect(screen.queryByRole('button', { name: 'Workplace of M0013' })).not.toBeInTheDocument();
  });
});
