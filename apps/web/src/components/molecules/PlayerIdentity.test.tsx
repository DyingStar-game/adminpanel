import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createSocialDataset, socialIds } from '@dyingstar-admin/testing';
import { PlayerIdentity } from './PlayerIdentity';

const players = createSocialDataset().players;
const find = (id: string) => {
  const player = players.find((p) => p.playerId === id);
  if (!player) throw new Error(`fixture ${id} missing`);
  return player;
};

describe('PlayerIdentity', () => {
  it('shows faction, role, biography and RP sheet', () => {
    render(<PlayerIdentity player={find(socialIds.griefer)} />);

    expect(screen.getByText('Faction').nextSibling).toHaveTextContent('Free miners');
    expect(screen.getByText('Role').nextSibling).toHaveTextContent('Pilot');
    expect(screen.getByText('Character').nextSibling).toHaveTextContent('Grif');
    expect(screen.getByText('Hauls ore between SandBox and its moons.')).toBeInTheDocument();
    expect(screen.getByText('Left the guild after a duel.')).toBeInTheDocument();
  });

  it('shows the biography and the story with their BBCode, as in game', () => {
    const player = find(socialIds.griefer);
    render(
      <PlayerIdentity
        player={{
          ...player,
          biography: '[b]Salut[/b], [color=#F8C3CD]Frank[/color]',
          rpSheet: { ...player.rpSheet, story: '[i]Exiled[/i] miner' },
        }}
      />,
    );

    expect(screen.getByText('Salut').tagName).toBe('STRONG');
    expect(screen.getByText('Exiled').tagName).toBe('EM');
    expect(screen.getAllByRole('button', { name: 'Show the code' })).toHaveLength(2);
  });

  it('says when the player told nothing about themselves', () => {
    render(<PlayerIdentity player={find(socialIds.reporter)} />);
    expect(screen.getByText('Nothing yet.')).toBeInTheDocument();
  });
});
