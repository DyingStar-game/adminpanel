import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ids } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { useInProcessBff } from '@/test/bff';
import { LIVE_INTERVALS } from '@/lib/live';
import { usePreferences } from '@/stores/preferences';
import { Inspector } from './Inspector';

afterEach(() => vi.useRealTimers());

/** Simulates a save by the game: persistence now holds another speed for the vehicle. */
function gameSavesSpeed(bff: ReturnType<typeof useInProcessBff>, speed: number) {
  const vehicle = bff.persistence.items.get(ids.vehicle);
  if (!vehicle) throw new Error('fixture vehicle missing');
  vehicle.object_data = { ...vehicle.object_data, speed };
}

const renderInspector = () =>
  renderWithProviders(<Inspector uuid={ids.vehicle} onNavigate={vi.fn()} onOpen={vi.fn()} />);

describe('Inspector live refresh', () => {
  it('refreshes the item and highlights the fields the game changed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const bff = useInProcessBff();
    usePreferences.setState({ live: true });
    renderInspector();
    expect(await screen.findByText('28.7')).toBeInTheDocument();
    expect(screen.getByText(/^updated /)).toBeInTheDocument();

    gameSavesSpeed(bff, 42);
    await vi.advanceTimersByTimeAsync(LIVE_INTERVALS.entity + 50);

    const value = await screen.findByText('42');
    expect(value.closest('[data-changed]')).not.toBeNull();
  });

  it('does not poll while live refresh is paused', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const bff = useInProcessBff();
    usePreferences.setState({ live: false });
    renderInspector();
    await screen.findByText('28.7');

    gameSavesSpeed(bff, 42);
    await vi.advanceTimersByTimeAsync(LIVE_INTERVALS.entity * 2);

    expect(screen.queryByText('42')).not.toBeInTheDocument();
    expect(screen.getByText('28.7')).toBeInTheDocument();
  });
});
