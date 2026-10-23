import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { createPois, poiIds } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { ObjectiveRoute } from './ObjectiveRoute';

const [, depot, drillSite] = createPois();

describe('ObjectiveRoute (ADR 0026)', () => {
  it('draws where to load and where to deliver, with the distance and where the goods are', () => {
    renderWithProviders(
      <ObjectiveRoute
        places={[
          { role: 'pickup', poiId: poiIds.depot, poi: depot },
          { role: 'dropoff', poiId: poiIds.drillSite, poi: drillSite },
        ]}
        cargo="4 crates · drill_parts"
        loaded
      />,
    );

    const route = screen.getByRole('figure', { name: 'Route of the objective' });
    expect(route).toHaveTextContent('Load');
    expect(screen.getByText('Vance depot')).toBeInTheDocument();
    expect(screen.getByText('Drill site 7')).toBeInTheDocument();
    expect(screen.getAllByText('Tarsis III — Sandbox')).toHaveLength(2);
    expect(screen.getByText('Zone of 120 m')).toBeInTheDocument();
    expect(screen.getByText('4 crates · drill_parts')).toBeInTheDocument();
    expect(screen.getByText(/km along the surface$/)).toBeInTheDocument();
    expect(screen.getByText('Loaded, on the way')).toBeInTheDocument();
  });

  it('says when a place is unknown to inventory, or was not read, by its id', () => {
    renderWithProviders(
      <ObjectiveRoute
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
    expect(screen.queryByText(/along the surface/)).toBeNull();
  });
});
