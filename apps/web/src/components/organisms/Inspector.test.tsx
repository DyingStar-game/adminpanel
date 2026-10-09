import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ids } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
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

  it('stops polling an item that disappeared', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const bff = useInProcessBff();
    usePreferences.setState({ live: true });
    renderInspector();
    await screen.findByText('28.7');

    // The game deletes (or respawns under another UUID) the vehicle.
    bff.persistence.items.delete(ids.vehicle);
    await vi.advanceTimersByTimeAsync(LIVE_INTERVALS.entity + 50);
    expect(await screen.findByText(/may have been deleted/)).toBeInTheDocument();
    const calls = bff.persistence.calls.get('GET /items/:uuid');

    await vi.advanceTimersByTimeAsync(LIVE_INTERVALS.entity * 3);
    expect(bff.persistence.calls.get('GET /items/:uuid')).toBe(calls);
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

describe('Inspector permissions (ADR 0023)', () => {
  it('hides the write actions to an account that may only read', async () => {
    useInProcessBff();
    renderWithProviders(
      <PermissionsContext.Provider value={['persistence.read', 'persistence.check']}>
        <Inspector uuid={ids.vehicle} onNavigate={vi.fn()} onOpen={vi.fn()} />
      </PermissionsContext.Provider>,
    );
    await screen.findByText('28.7');

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('shows them with the write right', async () => {
    useInProcessBff();
    renderInspector();
    await screen.findByText('28.7');

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});
