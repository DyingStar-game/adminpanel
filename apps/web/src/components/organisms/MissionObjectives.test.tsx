import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMissionDataset,
  createPois,
  missionIds,
  poiIds,
  socialIds,
} from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { MissionObjectives } from './MissionObjectives';

const { objectives } = createMissionDataset();
const of = (missionId: string) => objectives.filter((o) => o.missionId === missionId);
const places = Object.fromEntries([
  ...createPois().map((p) => [p.id, p] as const),
  [poiIds.missing, null] as const,
]);

describe('MissionObjectives (ADR 0026)', () => {
  it('shows each objective with what to do, its route and its progress, bonus ones last', () => {
    renderWithProviders(
      <MissionObjectives objectives={of(missionIds.delivery)} places={places} players={{}} />,
    );

    const [ore, bonus] = screen.getAllByRole('article');
    // Steps are counted from 1.
    expect(within(ore as HTMLElement).getByLabelText('Step 1')).toHaveTextContent('1');
    expect(ore).toHaveTextContent('Deliver 10 t of iron ore');
    expect(ore).toHaveTextContent('Deliver goods');
    expect(ore).toHaveTextContent('In progress');
    expect(ore).toHaveTextContent('What every assignee inside carries adds up.');
    expect(within(ore as HTMLElement).getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '6 / 10 t',
    );
    expect(bonus).toHaveTextContent('Report to the foreman');
    expect(bonus).toHaveTextContent('Bonus');
    expect(bonus).toHaveTextContent('200 credits');
    expect(bonus).toHaveTextContent('Not reached yet');
  });

  it('links a passenger to their sheet, and reads an owned quantity as one that can go down', async () => {
    const onOpenPlayer = vi.fn();
    renderWithProviders(
      <MissionObjectives
        objectives={[...of(missionIds.grouped), ...of(missionIds.transport)]}
        places={places}
        players={{ [socialIds.reporter]: 'ddurieux' }}
        onOpenPlayer={onOpenPlayer}
      />,
    );

    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'P' &&
          el.textContent === 'Bring ddurieux, seated but not driving, to Relay station.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /ddurieux/ }));
    expect(onOpenPlayer).toHaveBeenCalledWith(socialIds.reporter);
    // The relay station is in orbit: it stands on no body.
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Relay station' })[0] as HTMLElement,
    );
    expect(await screen.findByText('Open space')).toBeInTheDocument();
    expect(screen.getByText('What they hold now: it can go down.')).toBeInTheDocument();
    expect(
      screen.getAllByText('Never goes down: the best measure is kept.').length,
    ).toBeGreaterThan(0);
  });

  it('shows a kind it does not draw with its parameters, and a weight other than 1', () => {
    const [survey] = of(missionIds.scenario).slice(-1);
    if (!survey) throw new Error('fixture');
    renderWithProviders(
      <MissionObjectives
        objectives={[{ ...survey, type: 'escort_npc', params: { npcId: 'n-1' } }]}
        players={{}}
      />,
    );

    expect(screen.getByText('escort_npc')).toBeInTheDocument();
    expect(
      screen.getByText('A kind the panel does not draw yet: its parameters as stored.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/"npcId": "n-1"/)).toBeVisible();
    expect(screen.getByText('weight 2')).toBeInTheDocument();
  });

  it('chooses an objective with places for the map, and frames the chosen one (ADR 0027)', async () => {
    const onSelect = vi.fn();
    const [transport] = of(missionIds.transport);
    if (!transport) throw new Error('fixture');
    renderWithProviders(
      <MissionObjectives
        objectives={of(missionIds.transport)}
        places={places}
        players={{}}
        selected={transport.id}
        onSelect={onSelect}
      />,
    );

    const [chosen, owned] = screen.getAllByRole('article');
    expect(chosen).toHaveAttribute('aria-current', 'true');
    // Owning items sends no one anywhere: nothing to show on the map.
    expect(within(owned as HTMLElement).queryByRole('button', { name: 'On the map' })).toBeNull();
    const toggle = within(chosen as HTMLElement).getByRole('button', { name: 'On the map' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(toggle);
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });
});
