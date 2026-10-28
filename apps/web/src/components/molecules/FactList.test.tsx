import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FactList } from './FactList';

describe('FactList', () => {
  it('pairs each label with its value', () => {
    render(
      <FactList
        facts={[
          ['Faction', 'Free miners'],
          ['Role', <strong key="role">Pilot</strong>],
        ]}
      />,
    );
    expect(screen.getByText('Faction').nextElementSibling).toHaveTextContent('Free miners');
    expect(screen.getByText('Role').nextElementSibling).toHaveTextContent('Pilot');
  });

  it('puts two pairs a row on wider screens when asked', () => {
    render(<FactList columns={2} facts={[['Quantity', '600 l']]} />);
    expect(screen.getByText('Quantity').closest('dl')).toHaveClass(
      'sm:grid-cols-[auto_1fr_auto_1fr]',
    );
  });
});
