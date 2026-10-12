import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createUniversesimulatorDataset, simulationIds as ids } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { FlowDialog } from './FlowDialog';

const data = createUniversesimulatorDataset();
const village = { id: ids.f0001, name: 'F0001' };

describe('FlowDialog', () => {
  it('adds a consumption to a village, refusing a rate of 0', async () => {
    const bff = useInProcessBff();
    const onClose = vi.fn();
    renderWithProviders(
      <FlowDialog village={village} flow={null} resources={data.resources} onClose={onClose} />,
    );

    await userEvent.click(screen.getByRole('combobox', { name: 'Resource' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Food ration' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Source' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Population' }));
    const rate = screen.getByLabelText('Rate per game hour');
    await userEvent.type(rate, '0');
    expect(await screen.findByText(/A rate of 0 does nothing/)).toBeInTheDocument();
    await userEvent.clear(rate);
    await userEvent.type(rate, '-12.5');
    await userEvent.type(screen.getByLabelText('Label'), 'Dockers');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Food ration: -12.5/h (Population)');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.universesimulator.writes).toEqual([
      {
        call: 'POST /flows',
        body: {
          villageId: ids.f0001,
          resourceId: ids.food,
          ratePerHour: -12.5,
          source: 'population',
          label: 'Dockers',
        },
      },
    ]);
  });

  it("changes a flow's rate and clears its label", async () => {
    const bff = useInProcessBff();
    const flow = data.flows.find((f) => f.villageId === ids.f0001);
    if (!flow) throw new Error('fixture missing');
    renderWithProviders(
      <FlowDialog village={village} flow={flow} resources={data.resources} onClose={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { name: 'Flow of Water in F0001' })).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Resource' })).not.toBeInTheDocument();
    const next = screen.getByRole('button', { name: 'Continue' });
    expect(next).toBeDisabled();
    const rate = screen.getByLabelText('Rate per game hour');
    await userEvent.clear(rate);
    await userEvent.type(rate, '-40');
    await userEvent.clear(screen.getByLabelText('Label'));
    await userEvent.click(next);
    expect(screen.getByRole('alert')).toHaveTextContent('Rate per game hour: -25/h → -40/h');
    expect(screen.getByRole('alert')).toHaveTextContent('Label: Town → —');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() =>
      expect(bff.universesimulator.writes).toEqual([
        { call: `PUT /flows/${flow.id}`, body: { ratePerHour: -40, label: null } },
      ]),
    );
  });
});
