import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ids } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { PersistencePlayerLink } from './PersistencePlayerLink';

describe('PersistencePlayerLink', () => {
  it("opens the player's item and the map drawing it", async () => {
    useInProcessBff();
    const onOpenItem = vi.fn();
    const onOpenMap = vi.fn();
    renderWithProviders(
      <PersistencePlayerLink playerId={ids.player} onOpenItem={onOpenItem} onOpenMap={onOpenMap} />,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'View in persistence' }));
    expect(onOpenItem).toHaveBeenCalledWith(ids.player);
    await userEvent.click(await screen.findByRole('button', { name: 'Show on map' }));
    expect(onOpenMap).toHaveBeenCalledWith(ids.planet, ids.player);
  });

  it('is hidden from an account that may not read persistence', () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['social.moderate']}>
        <PersistencePlayerLink playerId={ids.player} onOpenItem={vi.fn()} onOpenMap={vi.fn()} />
      </PermissionsContext.Provider>,
    );
    expect(screen.queryByText('In game')).not.toBeInTheDocument();
  });
});
