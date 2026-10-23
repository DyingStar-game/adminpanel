import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMissionDataset, missionIds, simulationIds } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { MissionCancel } from './MissionCancel';

const renderCancel = (missionId: string, permissions?: string[]) => {
  const data = createMissionDataset();
  const mission = data.missions.find((m) => m.id === missionId);
  if (!mission) throw new Error(`No fixture mission ${missionId}`);
  const objectives = data.objectives.filter((o) => o.missionId === missionId);
  const ui = <MissionCancel mission={mission} objectives={objectives} />;
  renderWithProviders(
    permissions ? (
      <PermissionsContext.Provider value={permissions}>{ui}</PermissionsContext.Provider>
    ) : (
      ui
    ),
  );
};

describe('MissionCancel (ADR 0028)', () => {
  it('cancels a mission in mission after confirmation', async () => {
    const bff = useInProcessBff();
    renderCancel(missionIds.transport);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel the mission' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Cancel this mission?' });
    expect(dialog).toHaveTextContent('goes back to them');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel the mission' }));

    await vi.waitFor(() => expect(bff.mission.writes).toEqual([`cancel ${missionIds.transport}`]));
    expect(bff.universesimulator.writes).toEqual([]);
  });

  it('cancels a mission of the simulation through its supply order', async () => {
    const bff = useInProcessBff();
    renderCancel(missionIds.simulation);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel its supply order' }));
    const dialog = screen.getByRole('alertdialog', {
      name: 'Cancel the supply order of this mission?',
    });
    expect(dialog).toHaveTextContent('it would be published again');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel its supply order' }));

    await vi.waitFor(() =>
      expect(bff.universesimulator.writes.map((w) => w.call)).toEqual([
        `POST /orders/${simulationIds.waterOrder}/cancel`,
      ]),
    );
    expect(bff.mission.writes).toEqual([]);
  });

  it('says how a simulation mission is cancelled when its order is out of reach', async () => {
    useInProcessBff();
    renderCancel(missionIds.simulation, ['mission.read', 'mission.write']);

    expect(
      await screen.findByText('A mission of the simulation: cancelled through its supply order'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers nothing without the right, nor for a mission already closed', async () => {
    useInProcessBff();
    renderCancel(missionIds.transport, ['mission.read']);
    renderCancel(missionIds.simulation, ['mission.read', 'simulation.view']);
    renderCancel(missionIds.scenario);
    renderCancel(missionIds.cancelled);

    // Let the simulation's order arrive: still nothing to click.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
