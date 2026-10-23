import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPois, poiIds } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { ObjectivePlaces } from './ObjectivePlaces';

const [, depot, drillSite] = createPois();

describe('ObjectivePlaces (ADR 0027)', () => {
  it('lists the route on one line, each place opening its details', async () => {
    renderWithProviders(
      <ObjectivePlaces
        places={[
          { role: 'pickup', poiId: poiIds.depot, poi: depot },
          { role: 'dropoff', poiId: poiIds.drillSite, poi: drillSite },
        ]}
        loaded
      />,
    );

    const list = screen.getByRole('list', { name: 'Places of the objective' });
    expect(list).toHaveTextContent(/Load\s*Vance depot.*km.*Deliver\s*Drill site 7/);
    expect(screen.getByText('Loaded, on the way')).toBeInTheDocument();
    // Details on demand: body, position, zone, the id to copy.
    expect(screen.queryByText('Tarsis III — Sandbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Drill site 7' }));
    expect(await screen.findByText('Tarsis III — Sandbox')).toBeInTheDocument();
    expect(screen.getByText('Zone of 120 m')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy the POI id' })).toBeInTheDocument();
  });

  it('says when a place is unknown to inventory, or was not read, by its id', () => {
    renderWithProviders(
      <ObjectivePlaces
        places={[
          { role: 'target', poiId: poiIds.missing, poi: null },
          { role: 'dropoff', poiId: poiIds.depot, poi: undefined },
        ]}
        loaded={null}
      />,
    );

    expect(screen.getByText('Unknown place')).toBeInTheDocument();
    expect(screen.getByText('Not read from the inventory')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copy the POI id' })).toHaveLength(2);
    expect(screen.queryByText(/km/)).toBeNull();
  });
});
