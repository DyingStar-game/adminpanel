import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { npcIds as ids } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcEventsFeed } from './NpcEventsFeed';

describe('NpcEventsFeed', () => {
  it('lists every event newest first and loads the older ones', async () => {
    const bff = useInProcessBff();
    // 60 more events: the feed reads 50 at a time.
    for (let i = 0; i < 60; i++) {
      bff.npc.data.events.push({
        id: 100 + i,
        npcId: ids.alain,
        ts: new Date().toISOString(),
        kind: 'action_started',
        level: 'info',
        message: `tick ${i}`,
        data: null,
      });
    }
    const onOpenNpc = vi.fn();
    renderWithProviders(
      <NpcEventsFeed npcId={null} kind={undefined} onKindChange={vi.fn()} onOpenNpc={onOpenNpc} />,
    );

    const feed = await screen.findByRole('list', { name: 'Events' });
    await within(feed).findByText('tick 59');
    expect(within(feed).getAllByRole('listitem')).toHaveLength(50);
    await userEvent.click(
      within(within(feed).getAllByRole('listitem')[0] as HTMLElement).getByRole('button', {
        name: 'Open the NPC',
      }),
    );
    expect(onOpenNpc).toHaveBeenCalledWith(ids.alain);
    await userEvent.click(screen.getByRole('button', { name: 'Load older events' }));
    expect(await within(feed).findByText('NPCs enabled by dev-admin')).toBeInTheDocument();
    expect(within(feed).getAllByRole('listitem')).toHaveLength(72);
    const service = within(feed).getByText('NPCs enabled by dev-admin').closest('li');
    expect(service).toHaveTextContent('Service');
    expect(screen.queryByRole('button', { name: 'Load older events' })).not.toBeInTheDocument();
  });

  it("shows one NPC's events of a kind", async () => {
    useInProcessBff();
    const onKindChange = vi.fn();
    renderWithProviders(
      <NpcEventsFeed npcId={ids.alain} kind="connected" onKindChange={onKindChange} />,
    );

    const feed = await screen.findByRole('list', { name: 'Events' });
    expect(await within(feed).findByText('connected to Horizon')).toBeInTheDocument();
    expect(within(feed).getAllByRole('listitem')).toHaveLength(1);
    const kind = screen.getByLabelText('Event kind');
    await userEvent.clear(kind);
    await userEvent.type(kind, 'spawned{Enter}');
    expect(onKindChange).toHaveBeenCalledWith('spawned');
  });
});
