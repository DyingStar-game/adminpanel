import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { missionIds, socialIds } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { MissionPage } from './MissionPage';

const renderPage = (missionId: string, permissions?: string[]) => {
  const props = {
    onBack: vi.fn(),
    onOpenMission: vi.fn(),
    onOpenPlayer: vi.fn(),
    onOpenCorporation: vi.fn(),
    onOpenPoliticalEntity: vi.fn(),
  };
  const page = <MissionPage missionId={missionId} {...props} />;
  renderWithProviders(
    permissions ? (
      <PermissionsContext.Provider value={permissions}>{page}</PermissionsContext.Provider>
    ) : (
      page
    ),
  );
  return props;
};

describe('MissionPage (ADR 0024 step O)', () => {
  it('shows a mission: progress, terms, objectives and who took it', async () => {
    useInProcessBff();
    const props = renderPage(missionIds.delivery);

    expect(
      await screen.findByRole('heading', { name: 'Iron ore for New Haven' }),
    ).toBeInTheDocument();
    // 6 of the 10 t required, the bonus objective left out.
    expect(
      screen.getByText('Required objectives, weighted').previousElementSibling,
    ).toHaveTextContent('60%');
    expect(screen.getByText('of 3 places')).toBeInTheDocument();
    expect(screen.getByText('of which 1 partly')).toBeInTheDocument();
    expect(screen.getByText('System tarsis')).toBeInTheDocument();
    expect(screen.getByText('48 hours after taking it')).toBeInTheDocument();
    expect(screen.getByText('Allowed, paid in proportion (items excepted)')).toBeInTheDocument();
    // Each objective says what to do, with its places named from `inventory` (ADR 0026).
    expect(screen.getByText('Report to the foreman')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Be inside Foundry loading bay carrying 10 t of iron_ore: where it comes from is not checked. What every assignee inside carries adds up.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Unknown place')).toBeInTheDocument();

    // The mission to finish first, and the players, are ways to their pages.
    await userEvent.click(screen.getByRole('button', { name: /The first survey/ }));
    expect(props.onOpenMission).toHaveBeenCalledWith(missionIds.scenario);
    const takers = screen.getByRole('table', { name: 'Who took it' });
    await userEvent.click(within(takers).getByRole('button', { name: /ddurieux/ }));
    expect(props.onOpenPlayer).toHaveBeenCalledWith(socialIds.reporter);
  });

  it('shows the escrow of a corporation, and the group of a mission shared with one', async () => {
    useInProcessBff();
    renderPage(missionIds.transport);

    expect(await screen.findByText('4,000 credits, paid by: Corporation')).toBeInTheDocument();
    expect(screen.getByText('Items: Held')).toBeInTheDocument();
  });

  it("names the group a mission is shared with, whoever's group it is", async () => {
    useInProcessBff();
    renderPage(missionIds.grouped);

    expect(await screen.findByText('Relay strike team')).toBeInTheDocument();
    expect(screen.getByText('the first group to take it claims it')).toBeInTheDocument();
  });

  it('links players only for an account that may read social', async () => {
    useInProcessBff();
    renderPage(missionIds.delivery, ['mission.read']);

    const takers = await screen.findByRole('table', { name: 'Who took it' });
    expect(within(takers).getByText('ddurieux')).toBeInTheDocument();
    expect(within(takers).queryByRole('button')).toBeNull();
  });

  it('says when the mission does not exist', async () => {
    useInProcessBff();
    renderPage('3a55105e-0000-4000-8000-0000000000ff');

    expect(
      await screen.findByText(
        'No mission 3a55105e-0000-4000-8000-0000000000ff in the mission service.',
      ),
    ).toBeInTheDocument();
  });
});
