import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { organisationIds, simulationIds, socialIds } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { HolderLink } from './HolderLink';

describe('HolderLink', () => {
  it('names a corporation from `social`, a way to its page', async () => {
    useInProcessBff();
    const onOpen = vi.fn();
    renderWithProviders(
      <HolderLink type="corporation" id={organisationIds.mining} onOpen={onOpen} />,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Deep Core Mining' }));
    expect(onOpen).toHaveBeenCalledWith(organisationIds.mining);
  });

  it("names a political entity from the simulation's mirror", async () => {
    useInProcessBff();
    renderWithProviders(<HolderLink type="politics" id={simulationIds.ares} />);

    expect(await screen.findByText('ARES')).toBeInTheDocument();
  });

  it('names a player from the names `mission` gave', () => {
    useInProcessBff();
    renderWithProviders(
      <HolderLink type="player" id={socialIds.griefer} players={{ [socialIds.griefer]: 'Grim' }} />,
    );

    expect(screen.getByText('Grim')).toBeInTheDocument();
  });

  it('keeps the short id for who may read neither service', () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['mission.read']}>
        <HolderLink type="politics" id={simulationIds.ares} />
      </PermissionsContext.Provider>,
    );

    expect(screen.getByTitle(simulationIds.ares)).toHaveTextContent(simulationIds.ares.slice(0, 8));
  });
});
