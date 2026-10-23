import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { missionIds, simulationIds as sim } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { MissionSimulationOrigin } from './MissionSimulationOrigin';

const renderOrigin = (missionId: string, permissions = ['mission.read', 'simulation.view']) => {
  const onOpenOrders = vi.fn();
  renderWithProviders(
    <PermissionsContext.Provider value={permissions}>
      <MissionSimulationOrigin missionId={missionId} onOpenOrders={onOpenOrders} />
    </PermissionsContext.Provider>,
  );
  return onOpenOrders;
};

describe('MissionSimulationOrigin (ADR 0026)', () => {
  it('shows the supply order and the leg a mission of the simulation carries', async () => {
    useInProcessBff();
    const onOpenOrders = renderOrigin(sim.waterMission);

    const origin = await screen.findByRole('region', { name: 'Published by the simulation' });
    expect(origin).toHaveTextContent('Transport');
    expect(origin).toHaveTextContent('Leg 2 of 2:');
    expect(origin).toHaveTextContent('F0001');
    expect(origin).toHaveTextContent('M0002');
    await userEvent.click(screen.getByRole('button', { name: 'See the order' }));
    expect(onOpenOrders).toHaveBeenCalledWith({ resource: sim.water, village: sim.m0002 });
  });

  it('shows nothing for another mission, or without simulation.view', async () => {
    useInProcessBff();
    renderOrigin(missionIds.delivery);
    renderOrigin(sim.waterMission, ['mission.read']);
    // Let the orders arrive: still nothing.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('region', { name: 'Published by the simulation' })).toBeNull();
  });
});
