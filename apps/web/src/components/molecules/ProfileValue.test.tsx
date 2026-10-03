import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileValue } from './ProfileValue';

const base = { resolveRef: () => ({ status: 'missing' as const }), onNavigate: vi.fn(), data: {} };

describe('ProfileValue', () => {
  it('lists named maps one entry per line', () => {
    render(
      <ProfileValue
        {...base}
        renderer="namedMap"
        value={{ front_l_door: true, front_r_door: false }}
      />,
    );
    expect(screen.getByText('front_l_door')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();
  });

  it('shows angles in radians and degrees', () => {
    render(<ProfileValue {...base} renderer="angle" value={Math.PI / 2} />);
    expect(screen.getByText('1.571 rad · 90°')).toBeInTheDocument();
  });

  it('pairs orbital positions with rotations', () => {
    render(
      <ProfileValue
        {...base}
        renderer="orbitalSamples"
        value={[{ x: 1, y: 2, z: 3 }]}
        data={{ rotations: [{ w: 1, x: 0, y: 0, z: 0 }] }}
      />,
    );
    expect(screen.getByText('1 sample')).toBeInTheDocument();
    expect(screen.getByTitle('position x, y, z')).toHaveTextContent('1, 2, 3');
    expect(screen.getByTitle('rotation w, x, y, z')).toHaveTextContent('1, 0, 0, 0');
  });

  it('falls back to the generic renderer', () => {
    render(<ProfileValue {...base} renderer={undefined} value={[-7, -7]} />);
    expect(screen.getByRole('button', { name: '2 items' })).toBeInTheDocument();
  });
});
