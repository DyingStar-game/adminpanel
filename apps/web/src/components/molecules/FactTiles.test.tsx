import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FactTiles } from './FactTiles';

describe('FactTiles', () => {
  it('shows each figure with its label and hint', () => {
    render(
      <FactTiles
        facts={[
          { label: 'Players', value: 3, hint: '1 online' },
          { label: 'Active sanctions', value: 0 },
        ]}
      />,
    );

    expect(screen.getByText('Players').nextSibling).toHaveTextContent('3');
    expect(screen.getByText('1 online')).toBeInTheDocument();
    expect(screen.getByText('Active sanctions').nextSibling).toHaveTextContent('0');
  });
});
