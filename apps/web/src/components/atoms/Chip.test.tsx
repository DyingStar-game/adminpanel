import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chip } from './Chip';

describe('Chip', () => {
  it('shows a value as plain text', () => {
    render(<Chip>Radius 6,356 km</Chip>);
    expect(screen.getByText('Radius 6,356 km').tagName).toBe('SPAN');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reads as a link when it leads somewhere: a button with an arrow', async () => {
    const onClick = vi.fn();
    render(
      <Chip variant="link" onClick={onClick}>
        Star Tarsis α
      </Chip>,
    );
    const link = screen.getByRole('button', { name: 'Star Tarsis α' });
    expect(link).toHaveClass('text-link');
    expect(link.querySelector('svg')).not.toBeNull();
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
