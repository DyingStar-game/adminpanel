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
});
