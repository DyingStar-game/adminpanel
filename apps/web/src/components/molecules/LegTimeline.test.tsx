import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createUniversesimulatorDataset, simulationIds as ids } from '@dyingstar-admin/testing';
import { LegTimeline } from './LegTimeline';

describe('LegTimeline', () => {
  it('lists the hops between villages in order, each with its status and labelled facts', () => {
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
        statusLabel={(s) => s.toUpperCase()}
        facts={(leg) => [
          ['Quantity', `${leg.quantity} l`],
          ['Mission', leg.missionId ?? '—'],
        ]}
      />,
    );

    const hops = screen.getAllByRole('listitem');
    expect(hops.map((li) => within(li).getByText(/^[A-Z]+$/).textContent)).toEqual([
      'COMPLETED',
      'PUBLISHED',
    ]);
    const second = within(hops[1] as HTMLElement);
    expect(second.getByRole('heading')).toHaveTextContent('F0001M0002');
    expect(second.getByText('Quantity').nextElementSibling).toHaveTextContent('600 l');
    expect(second.getByText('Mission').nextElementSibling).toHaveTextContent(ids.waterMission);
  });
});
