import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RefTarget } from './UuidLink';
import { ValueView } from './ValueView';

const PLAYER = '1b029618-ee3b-4045-abaa-ed1fafd9f8f8';
const MISSING = 'deadbeef-0000-0000-0000-000000000000';
const resolveRef = (uuid: string): RefTarget =>
  uuid === PLAYER
    ? { status: 'found', label: 'ddurieux', objectType: 'player' }
    : { status: 'missing' };

const view = (value: unknown, name?: string, onNavigate = vi.fn()) =>
  render(<ValueView value={value} name={name} resolveRef={resolveRef} onNavigate={onNavigate} />);

describe('ValueView', () => {
  it('renders vectors and quaternions compactly', () => {
    view({ x: 1.23456, y: 0, z: -2 });
    expect(screen.getByTitle('x, y, z')).toHaveTextContent('1.235, 0, -2');

    view({ w: 1, x: 0, y: 0, z: 0 });
    expect(screen.getByTitle('w, x, y, z')).toHaveTextContent('1, 0, 0, 0');
  });

  it('marks empty strings as an empty link rather than hiding them', () => {
    view('');
    expect(screen.getByText(/empty/)).toBeInTheDocument();
  });

  it('turns references into links and flags broken ones', async () => {
    const onNavigate = vi.fn();
    view(PLAYER, 'pilot_uuid', onNavigate);
    await userEvent.click(screen.getByRole('button', { name: /ddurieux/ }));
    expect(onNavigate).toHaveBeenCalledWith(PLAYER);

    view(MISSING);
    expect(screen.getByText(/missing item/)).toBeInTheDocument();
  });

  it('renders timestamps as dates', () => {
    view(1790858538, 'from_timestamp');
    expect(screen.getByTitle('1790858538').textContent).toMatch(/2026/);
  });

  it('collapses nested objects and resolves references inside', async () => {
    view({ seat_driver: PLAYER, seat_passenger: '' });

    const toggle = screen.getByRole('button', { name: '2 keys' });
    expect(screen.queryByText('seat_driver')).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByText('seat_driver')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ddurieux/ })).toBeInTheDocument();
  });

  it('copies the full UUID of a reference without navigating', async () => {
    const onNavigate = vi.fn();
    view(PLAYER, 'pilot_uuid', onNavigate);

    await userEvent.click(screen.getByRole('button', { name: 'Copy UUID' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(PLAYER);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Copy UUID' })).toHaveAttribute('title', 'Copied');
  });

  it('copies a position as exact JSON', async () => {
    view({ x: 1.23456, y: 0, z: -2 });

    await userEvent.click(screen.getByRole('button', { name: 'Copy value (JSON)' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{"x":1.23456,"y":0,"z":-2}');
  });
});
