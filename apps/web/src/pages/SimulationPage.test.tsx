import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ids, simulationIds as sim } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { SimulationPage } from './SimulationPage';

describe('SimulationPage (ADR 0025)', () => {
  it('opens on the overview and changes tab through the URL state', async () => {
    useInProcessBff();
    const onSearchChange = vi.fn();
    renderWithProviders(
      <SimulationPage
        search={{ tab: 'overview' }}
        onSearchChange={onSearchChange}
        onOpenMission={vi.fn()}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Simulation' })).toBeInTheDocument();
    expect(await screen.findByText('Federation ARES · tarsis_3')).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Villages below their threshold' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Transits & missions' }));
    expect(onSearchChange).toHaveBeenCalledWith({ tab: 'orders' });
  });

  it('shows the tab of the URL', async () => {
    useInProcessBff();
    renderWithProviders(
      <SimulationPage
        search={{ tab: 'treasury' }}
        onSearchChange={vi.fn()}
        onOpenMission={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole('table', { name: 'Money issued into the treasury' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Federation ARES · tarsis_3')).not.toBeInTheDocument();
  });

  it("edits a village's threshold and adds a flow from its panel (ADR 0025 › Configuration)", async () => {
    const bff = useInProcessBff();
    renderWithProviders(
      <div style={{ width: 1400, height: 900 }}>
        <SimulationPage
          search={{ tab: 'network', village: sim.m0002, body: ids.planet }}
          onSearchChange={vi.fn()}
          onOpenMission={vi.fn()}
        />
      </div>,
    );
    const panel = await screen.findByRole('complementary', { name: 'M0002' });
    const policies = within(panel).getByRole('table', { name: 'Thresholds' });

    // The threshold of water, 300 → 450.
    await userEvent.click(
      await within(policies).findByRole('button', { name: 'Edit the threshold · Water' }),
    );
    const threshold = screen.getByLabelText('Minimum threshold (l)');
    await userEvent.clear(threshold);
    await userEvent.type(threshold, '450');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await within(policies).findByRole('row', { name: /^Water 450/ })).toBeInTheDocument();

    // A new production of food.
    await userEvent.click(within(panel).getByRole('button', { name: 'Add a flow' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Resource' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Food ration' }));
    await userEvent.type(screen.getByLabelText('Rate per game hour'), '15');
    await userEvent.type(screen.getByLabelText('Label'), 'Greenhouse');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    const flows = within(panel).getByRole('table', { name: 'Flows' });
    expect(await within(flows).findByRole('row', { name: /Greenhouse/ })).toHaveTextContent(
      '+15/h',
    );

    expect(bff.universesimulator.writes.map((w) => w.call)).toEqual([
      'PUT /village-policies',
      'POST /flows',
    ]);
    expect(
      bff.universesimulator.data.policies.find(
        (p) => p.villageId === sim.m0002 && p.resourceId === sim.water,
      ),
    ).toEqual({
      villageId: sim.m0002,
      resourceId: sim.water,
      minThreshold: 450,
      targetLevel: 1_000,
    });
    // A whole journey through the in-process BFF: two dialogs, typed values, two refreshes.
  }, 20_000);
});
