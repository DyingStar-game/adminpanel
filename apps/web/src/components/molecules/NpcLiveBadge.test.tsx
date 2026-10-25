import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NpcLiveBadge } from './NpcLiveBadge';

describe('NpcLiveBadge', () => {
  it('names the live state next to its colour', () => {
    render(<NpcLiveBadge state="running" label="Running (off shift)" />);

    expect(screen.getByText('Running (off shift)')).toHaveAttribute('data-live', 'running');
  });
});
