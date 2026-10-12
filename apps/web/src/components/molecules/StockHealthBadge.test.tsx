import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StockHealthBadge } from './StockHealthBadge';

describe('StockHealthBadge', () => {
  it('names the health next to its colour', () => {
    render(<StockHealthBadge health="below" label="Below threshold" />);

    expect(screen.getByText('Below threshold')).toHaveAttribute('data-health', 'below');
  });
});
