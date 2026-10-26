import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { npcIds as ids } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcPage } from './NpcPage';

const handlers = () => ({
  onSearchChange: vi.fn(),
  onBack: vi.fn(),
  onDeleted: vi.fn(),
  onEditPattern: vi.fn(),
});

describe('NpcPage (ADR 0031)', () => {
  it('heads with the NPC and opens on its overview; tabs go through the URL state', async () => {
    useInProcessBff();
    const props = handlers();
    renderWithProviders(<NpcPage npcId={ids.alain} search={{ tab: 'overview' }} {...props} />);

    expect(await screen.findByRole('heading', { name: 'Alain Deloin' })).toBeInTheDocument();
    expect(screen.getByText('Current action').nextElementSibling).toHaveTextContent(
      'depot_store_item',
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Logs' }));
    expect(props.onSearchChange).toHaveBeenCalledWith({ tab: 'logs' });
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(props.onBack).toHaveBeenCalled();
  });

  it('shows the tab of the URL: its tasks', async () => {
    useInProcessBff();
    renderWithProviders(<NpcPage npcId={ids.camille} search={{ tab: 'tasks' }} {...handlers()} />);

    expect(await screen.findByRole('table', { name: 'Tasks' })).toBeInTheDocument();
    expect(await screen.findByRole('row', { name: /timeout: not arrived/ })).toBeInTheDocument();
  });

  it('edits its configuration from the Config tab', async () => {
    const bff = useInProcessBff();
    renderWithProviders(<NpcPage npcId={ids.denis} search={{ tab: 'config' }} {...handlers()} />);

    const notes = await screen.findByLabelText('Notes');
    await userEvent.type(notes, 'Night watch');
    await userEvent.click(screen.getByRole('button', { name: 'Save the configuration' }));
    await vi.waitFor(() =>
      expect(bff.npc.writes).toEqual([
        { call: `PATCH /npcs/${ids.denis}`, body: { notes: 'Night watch' } },
      ]),
    );
  });

  it('says when the NPC does not exist', async () => {
    useInProcessBff();
    renderWithProviders(
      <NpcPage
        npcId="c0ffee00-0000-4000-8000-0000000000ff"
        search={{ tab: 'overview' }}
        {...handlers()}
      />,
    );

    expect(await screen.findByText('This NPC does not exist (any more).')).toBeInTheDocument();
  });
});
