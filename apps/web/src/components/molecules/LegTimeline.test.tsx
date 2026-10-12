import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createUniversesimulatorDataset, simulationIds as ids } from '@dyingstar-admin/testing';
import { LegTimeline } from './LegTimeline';

describe('LegTimeline', () => {
  it('lists the hops between villages in order, with their warehouses, status and mission', () => {
    const order = createUniversesimulatorDataset().orders.find((o) => o.id === ids.waterOrder);
    const villages: Record<string, string> = {
      [ids.c0001]: 'C0001',
      [ids.f0001]: 'F0001',
      [ids.m0002]: 'M0002',
    };
    render(
      <LegTimeline
        legs={[...(order?.legs ?? [])].reverse()}
        placeName={(id) => (id ? (villages[id] ?? id) : 'Mine')}
        warehouseName={(id) => (id === ids.f0001Main ? 'F0001 depot' : 'M0002 depot')}
        statusLabel={(s) => s.toUpperCase()}
        facts={(leg) => `${leg.quantity} l`}
        missionLabel="Mission"
      />,
    );

    const hops = screen.getAllByRole('listitem');
    expect(hops.map((li) => within(li).getByText(/^[A-Z]+$/).textContent)).toEqual([
      'COMPLETED',
      'PUBLISHED',
    ]);
    expect(hops[1]).toHaveTextContent('F0001');
    expect(hops[1]).toHaveTextContent('M0002');
    expect(hops[1]).toHaveTextContent('F0001 depot → M0002 depot');
    expect(within(hops[1] as HTMLElement).getByText(ids.waterMission)).toBeInTheDocument();
  });
});
