import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiscoveryRowSchema, type DiscoveryRow } from '@dyingstar-admin/schemas';
import { createDiscoveries, ids, socialIds } from '@dyingstar-admin/testing';
import type { RefTarget } from '@/components/molecules/UuidLink';
import { renderWithProviders } from '@/test/render';
import { DiscoveriesTable } from './DiscoveriesTable';

const rows: DiscoveryRow[] = createDiscoveries()
  .filter((item) => item.object_type === 'discovery')
  .map((item) =>
    DiscoveryRowSchema.parse({ uuid: item.object_uuid, object_data: item.object_data }),
  );
const row = (uuid: string) => rows.filter((r) => r.uuid === uuid);
const caves: Record<string, RefTarget> = {
  [ids.caveEcho]: { status: 'found', label: 'tarsis_3_cave_017', objectType: 'cave' },
};
const resolvePlace = (uuid: string): RefTarget => caves[uuid] ?? { status: 'missing' };

describe('DiscoveriesTable (ADR 0032)', () => {
  it('shows a name to review: kind, discoverer, planet, dates, place, decisions', async () => {
    const onDecide = vi.fn();
    const onOpenPlace = vi.fn();
    const onOpenPlayer = vi.fn();
    renderWithProviders(
      <DiscoveriesTable
        discoveries={row(ids.discoveryEcho)}
        resolvePlace={resolvePlace}
        onOpenPlace={onOpenPlace}
        onOpenPlayer={onOpenPlayer}
        onDecide={onDecide}
      />,
    );
    const table = screen.getByRole('table', { name: 'Names to review' });
    const line = within(table).getByText("L'Antre des Échos").closest('tr') as HTMLElement;

    expect(line).toHaveTextContent('Cave');
    expect(line).toHaveTextContent('Tarsis III (Sandbox)');
    expect(line).toHaveTextContent('2026');
    // No decision yet: no column for it.
    expect(within(table).queryByText('Decided')).not.toBeInTheDocument();
    await userEvent.click(within(line).getByText('griefer42'));
    expect(onOpenPlayer).toHaveBeenCalledWith(socialIds.griefer);
    await userEvent.click(within(line).getByText('tarsis_3_cave_017'));
    expect(onOpenPlace).toHaveBeenCalledWith(ids.caveEcho);
    await userEvent.click(within(line).getByRole('button', { name: 'Refuse' }));
    expect(onDecide).toHaveBeenCalledWith(row(ids.discoveryEcho)[0], 'refuse');
  });

  it('shows the decided names, their decision date and the reason of a refusal, no action', () => {
    renderWithProviders(
      <DiscoveriesTable
        discoveries={[...row(ids.discoveryHollow), ...row(ids.discoverySpire)]}
        resolvePlace={resolvePlace}
        onOpenPlace={vi.fn()}
        onDecide={vi.fn()}
      />,
    );
    const table = screen.getByRole('table', { name: 'Names to review' });

    expect(within(table).getByText('Decided')).toBeInTheDocument();
    expect(within(table).getByText('Deep Hollow')).toBeInTheDocument();
    expect(within(table).getByText('Names may not advertise a player.')).toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    // A place missing from persistence is flagged.
    expect(within(table).getAllByText(/missing/)).toHaveLength(2);
  });

  it('names an unknown kind of place as the game does, and offers no decision without the rights', () => {
    const [first] = row(ids.discoveryFang);
    if (!first) throw new Error('fixture missing');
    renderWithProviders(
      <DiscoveriesTable
        discoveries={[{ ...first, object_data: { ...first.object_data, place_kind: 'lake' } }]}
        resolvePlace={resolvePlace}
        onOpenPlace={vi.fn()}
      />,
    );
    const table = screen.getByRole('table', { name: 'Names to review' });

    expect(within(table).getByText('lake')).toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    // Without a player link, the discoverer's name is text.
    expect(within(table).getByText('ddurieux').tagName).toBe('SPAN');
  });
});
